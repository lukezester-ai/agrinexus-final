import json
import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import psycopg2
import pytest

from domain.market_data import OhlcvBar
from engine.ingest import series_payload, validate_ohlcv_series

SUPER_DSN = os.environ.get("DB_URL_SUPERUSER")
APP_DSN = os.environ.get("DB_URL_APPUSER")

USER_A = "11111111-1111-1111-1111-111111111111"
USER_B = "22222222-2222-2222-2222-222222222222"
USER_C = "33333333-3333-3333-3333-333333333333"
USER_D = "44444444-4444-4444-4444-444444444444"
ORG_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
ORG_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"

pytestmark = pytest.mark.skipif(
    not SUPER_DSN or not APP_DSN,
    reason="DB_URL_SUPERUSER and DB_URL_APPUSER are required",
)


def as_user(conn, user_id: str) -> None:
    claims = json.dumps({"sub": user_id, "role": "authenticated", "aud": "authenticated"})
    with conn.cursor() as cur:
        cur.execute(
            "SELECT set_config('request.jwt.claim.sub', %s, true), set_config('request.jwt.claims', %s, true)",
            (user_id, claims),
        )
        cur.fetchone()


def _bars(timeframe_hours: int, prices: tuple[str, ...]) -> list[dict]:
    start = datetime(2024, 1, 1, tzinfo=timezone.utc)
    bars = []
    for index, price_text in enumerate(prices):
        price = Decimal(price_text)
        bars.append(
            OhlcvBar(
                index,
                start + timedelta(hours=timeframe_hours * index),
                price,
                price + Decimal("0.5"),
                price - Decimal("0.5"),
                price,
                Decimal("100"),
            )
        )
    return series_payload(validate_ohlcv_series("1d" if timeframe_hours == 24 else "1h", bars))


def test_market_universe_ingestion_and_watchlist_isolation():
    daily = _bars(24, ("100", "101", "102"))
    hourly = _bars(1, ("50", "51"))

    with psycopg2.connect(SUPER_DSN) as admin, admin.cursor() as cur:
        cur.execute(
            """
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name LIKE 'finance_%'
              AND column_name ~* 'broker|endpoint|api_key|secret'
            """
        )
        assert cur.fetchall() == []
        cur.execute("TRUNCATE public.organizations CASCADE")
        cur.execute(
            "INSERT INTO public.organizations (id, name, owner_user_id) VALUES (%s, 'Fund A', %s), (%s, 'Fund B', %s)",
            (ORG_A, USER_A, ORG_B, USER_C),
        )
        cur.execute(
            """
            INSERT INTO public.organization_memberships (organization_id, user_id, role)
            VALUES (%s,%s,'owner'),(%s,%s,'member'),(%s,%s,'viewer'),(%s,%s,'owner')
            """,
            (ORG_A, USER_A, ORG_A, USER_B, ORG_A, USER_D, ORG_B, USER_C),
        )

    member = psycopg2.connect(APP_DSN)
    member.autocommit = False
    try:
        as_user(member, USER_B)
        with member.cursor() as cur:
            with pytest.raises(psycopg2.Error):
                cur.execute(
                    "SELECT public.finance_register_data_provider(%s, %s, %s)",
                    (ORG_A, "Live", "broker"),
                )
            member.rollback()
            as_user(member, USER_B)
            cur.execute(
                "SELECT public.finance_register_instrument(%s, %s, %s, %s, %s, %s)",
                (ORG_A, "aapl", "Apple", "xnas", "equity", "usd"),
            )
            instrument_id = cur.fetchone()[0]
            cur.execute(
                "SELECT symbol, exchange, asset_class, currency FROM public.finance_instruments WHERE id = %s",
                (instrument_id,),
            )
            assert cur.fetchone() == ("AAPL", "XNAS", "equity", "USD")
            with pytest.raises(psycopg2.Error):
                cur.execute(
                    "UPDATE public.finance_instruments SET exchange = 'BROKER' WHERE id = %s",
                    (instrument_id,),
                )
            member.rollback()
            as_user(member, USER_B)
            cur.execute(
                "SELECT public.finance_register_instrument(%s, %s, %s, %s, %s, %s)",
                (ORG_A, "aapl", "Apple", "xnas", "equity", "usd"),
            )
            instrument_id = cur.fetchone()[0]
            cur.execute(
                "SELECT public.finance_register_data_provider(%s, %s, %s)",
                (ORG_A, "Desk fixture", "fixture"),
            )
            provider_id = cur.fetchone()[0]
            cur.execute(
                "SELECT public.finance_ingest_market_bars(%s, %s, %s, %s::jsonb)",
                (instrument_id, "1d", provider_id, json.dumps(daily)),
            )
            assert cur.fetchone()[0] == 3
            cur.execute(
                "SELECT public.finance_ingest_market_bars(%s, %s, %s, %s::jsonb)",
                (instrument_id, "1h", provider_id, json.dumps(hourly)),
            )
            assert cur.fetchone()[0] == 2
            cur.execute(
                "SELECT public.finance_ingest_market_bars(%s, %s, %s, %s::jsonb)",
                (instrument_id, "1d", provider_id, json.dumps(daily)),
            )
            assert cur.fetchone()[0] == 3
            cur.execute(
                """
                SELECT timeframe, bar_index, close
                FROM public.finance_market_bars
                WHERE instrument_id = %s
                ORDER BY timeframe, bar_index
                """,
                (instrument_id,),
            )
            stored = [(timeframe, index, Decimal(close)) for timeframe, index, close in cur.fetchall()]
            assert stored == [
                ("1d", 0, Decimal("100")),
                ("1d", 1, Decimal("101")),
                ("1d", 2, Decimal("102")),
                ("1h", 0, Decimal("50")),
                ("1h", 1, Decimal("51")),
            ]
            cur.execute("SELECT public.finance_create_watchlist(%s, %s)", (ORG_A, "Core book"))
            watchlist_id = cur.fetchone()[0]
            cur.execute(
                "SELECT public.finance_add_watchlist_instrument(%s, %s)",
                (watchlist_id, instrument_id),
            )
            assert cur.fetchone()[0] == 0
            cur.execute(
                "SELECT count(*) FROM public.finance_audit_log WHERE organization_id = %s AND actor_user_id = %s",
                (ORG_A, USER_B),
            )
            assert cur.fetchone()[0] >= 5
        member.commit()
    finally:
        member.close()

    outsider = psycopg2.connect(APP_DSN)
    outsider.autocommit = False
    try:
        as_user(outsider, USER_C)
        with outsider.cursor() as cur:
            cur.execute("SELECT count(*) FROM public.finance_watchlists")
            assert cur.fetchone()[0] == 0
            cur.execute("SELECT count(*) FROM public.finance_market_bars")
            assert cur.fetchone()[0] == 0
            cur.execute(
                "SELECT public.finance_register_instrument(%s, %s, %s, %s, %s, %s)",
                (ORG_B, "msft", "Microsoft", "xnas", "equity", "usd"),
            )
            foreign_instrument = cur.fetchone()[0]
            with pytest.raises(psycopg2.Error):
                cur.execute(
                    "SELECT public.finance_add_watchlist_instrument(%s, %s)",
                    (watchlist_id, foreign_instrument),
                )
        outsider.rollback()
    finally:
        outsider.close()

    viewer = psycopg2.connect(APP_DSN)
    viewer.autocommit = False
    try:
        as_user(viewer, USER_D)
        with viewer.cursor() as cur:
            cur.execute("SELECT count(*) FROM public.finance_watchlists")
            assert cur.fetchone()[0] == 1
            cur.execute("SELECT count(*) FROM public.finance_watchlist_items")
            assert cur.fetchone()[0] == 1
            with pytest.raises(psycopg2.Error):
                cur.execute(
                    "SELECT public.finance_remove_watchlist_instrument(%s, %s)",
                    (watchlist_id, instrument_id),
                )
        viewer.rollback()
    finally:
        viewer.close()

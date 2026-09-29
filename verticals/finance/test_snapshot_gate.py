import json
import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import psycopg2
import pytest

from domain.screeners import ScreenerSeries
from engine.fixture import fixture_closes
from engine.snapshot import market_snapshot
from engine.test_screener import PRICE_RULE

SUPER_DSN = os.environ.get("DB_URL_SUPERUSER")
APP_DSN = os.environ.get("DB_URL_APPUSER")

USER_A = "11111111-1111-1111-1111-111111111111"
USER_B = "22222222-2222-2222-2222-222222222222"
USER_C = "33333333-3333-3333-3333-333333333333"
USER_D = "44444444-4444-4444-4444-444444444444"
ORG_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
ORG_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
START = datetime(2024, 1, 1, tzinfo=timezone.utc)

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


def _bars(closes: list[Decimal], volume: str) -> list[dict]:
    bars = []
    for index, close in enumerate(closes):
        price = format(close, "f")
        bars.append(
            {
                "bar_index": index,
                "bar_time": (START + timedelta(days=index)).isoformat(),
                "open": price,
                "high": price,
                "low": price,
                "close": price,
                "volume": volume,
            }
        )
    return bars


def _series(symbol: str, closes: list[Decimal], volume: str) -> ScreenerSeries:
    return ScreenerSeries("NONE", symbol, tuple(closes), tuple(Decimal(volume) for _ in closes))


def _assert_snapshot(cur, snapshot_id, expected) -> None:
    cur.execute(
        """
        SELECT exchange, symbol, bar_index, price, volume, included
        FROM public.finance_snapshot_states
        WHERE snapshot_id = %s
        ORDER BY exchange, symbol
        """,
        (snapshot_id,),
    )
    assert cur.fetchall() == [
        (point.exchange, point.symbol, point.bar_index, point.price, point.volume, point.included)
        for point in expected.points
    ]
    cur.execute(
        """
        SELECT states.symbol, features.kind, features.period, features.value
        FROM public.finance_snapshot_features features
        JOIN public.finance_snapshot_states states
          ON states.snapshot_id = features.snapshot_id
         AND states.instrument_id = features.instrument_id
        WHERE features.snapshot_id = %s
        """,
        (snapshot_id,),
    )
    stored: dict[str, dict[tuple[str, int], Decimal | None]] = {}
    for symbol, kind, period, value in cur.fetchall():
        stored.setdefault(symbol, {})[(kind, period)] = value
    for point in expected.points:
        assert stored[point.symbol] == {(kind, period): value for kind, period, value in point.features}
    cur.execute("SELECT result_digest FROM public.finance_market_snapshots WHERE id = %s", (snapshot_id,))
    assert cur.fetchone()[0] == expected.digest


def test_snapshot_matches_python_at_the_same_cutoff():
    closes = fixture_closes()
    flat = [Decimal("50")] * len(closes)
    full = market_snapshot(
        [_series("BETA", flat, "10"), _series("ACME", closes, "1000")],
        PRICE_RULE,
    )
    cutoff_at = START + timedelta(days=40)
    cutoff = market_snapshot(
        [_series("BETA", flat[:41], "10"), _series("ACME", closes[:41], "1000")],
        PRICE_RULE,
    )
    screener_id = None
    full_id = None

    with psycopg2.connect(SUPER_DSN) as admin, admin.cursor() as cur:
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
            cur.execute("SELECT public.finance_create_instrument(%s, %s, %s)", (ORG_A, "BETA", "Beta"))
            beta_id = cur.fetchone()[0]
            cur.execute("SELECT public.finance_create_instrument(%s, %s, %s)", (ORG_A, "ACME", "Acme"))
            acme_id = cur.fetchone()[0]
            cur.execute(
                "SELECT public.finance_replace_market_bars(%s, %s::jsonb)",
                (beta_id, json.dumps(_bars(flat, "10"))),
            )
            cur.fetchone()
            cur.execute(
                "SELECT public.finance_replace_market_bars(%s, %s::jsonb)",
                (acme_id, json.dumps(_bars(closes, "1000"))),
            )
            cur.fetchone()
            cur.execute(
                "SELECT public.finance_create_screener(%s, %s, %s::jsonb)",
                (ORG_A, "Liquid rise", json.dumps(PRICE_RULE)),
            )
            screener_id = cur.fetchone()[0]
            cur.execute("SELECT public.finance_run_screener(%s)", (screener_id,))
            run_id = cur.fetchone()[0]
            cur.execute("SELECT public.finance_capture_snapshot(%s, NULL)", (screener_id,))
            full_id = cur.fetchone()[0]
            _assert_snapshot(cur, full_id, full)
            cur.execute(
                """
                SELECT symbol FROM public.finance_screener_candidates
                WHERE run_id = %s ORDER BY symbol
                """,
                (run_id,),
            )
            assert cur.fetchall() == [(point.symbol,) for point in full.points if point.included]
            cur.execute("SELECT public.finance_capture_snapshot(%s, NULL)", (screener_id,))
            cur.execute("SELECT result_digest FROM public.finance_market_snapshots WHERE id = %s", (cur.fetchone()[0],))
            assert cur.fetchone()[0] == full.digest
            cur.execute("SELECT public.finance_capture_snapshot(%s, %s)", (screener_id, cutoff_at))
            cutoff_id = cur.fetchone()[0]
            _assert_snapshot(cur, cutoff_id, cutoff)
            cur.execute("SELECT public.finance_capture_snapshot(%s, %s)", (screener_id, cutoff_at))
            cur.execute("SELECT result_digest FROM public.finance_market_snapshots WHERE id = %s", (cur.fetchone()[0],))
            assert cur.fetchone()[0] == cutoff.digest
            longer = closes + [closes[-1] + Decimal("0.20")]
            cur.execute(
                "SELECT public.finance_replace_market_bars(%s, %s::jsonb)",
                (acme_id, json.dumps(_bars(longer, "1000"))),
            )
            cur.fetchone()
            cur.execute("SELECT public.finance_capture_snapshot(%s, %s)", (screener_id, cutoff_at))
            cur.execute("SELECT result_digest FROM public.finance_market_snapshots WHERE id = %s", (cur.fetchone()[0],))
            assert cur.fetchone()[0] == cutoff.digest
            cur.execute(
                "SELECT price FROM public.finance_snapshot_states WHERE snapshot_id = %s AND symbol = 'ACME'",
                (full_id,),
            )
            assert cur.fetchone()[0] == full.points[0].price
            cur.execute("SAVEPOINT state_update")
            with pytest.raises(psycopg2.Error):
                cur.execute(
                    "UPDATE public.finance_snapshot_states SET price = 0 WHERE snapshot_id = %s",
                    (full_id,),
                )
            cur.execute("ROLLBACK TO SAVEPOINT state_update")
        member.commit()
    finally:
        member.close()

    outsider = psycopg2.connect(APP_DSN)
    outsider.autocommit = False
    try:
        as_user(outsider, USER_C)
        with outsider.cursor() as cur:
            cur.execute("SELECT count(*) FROM public.finance_snapshot_states")
            assert cur.fetchone()[0] == 0
        outsider.rollback()
    finally:
        outsider.close()

    viewer = psycopg2.connect(APP_DSN)
    viewer.autocommit = False
    try:
        as_user(viewer, USER_D)
        with viewer.cursor() as cur:
            cur.execute("SELECT DISTINCT symbol FROM public.finance_snapshot_states ORDER BY symbol")
            assert cur.fetchall() == [("ACME",), ("BETA",)]
            with pytest.raises(psycopg2.Error):
                cur.execute("SELECT public.finance_capture_snapshot(%s, NULL)", (screener_id,))
        viewer.rollback()
    finally:
        viewer.close()

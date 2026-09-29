import json
import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import psycopg2
import pytest

from domain.screeners import ScreenerSeries
from engine.fixture import fixture_closes
from engine.screener import screen
from engine.test_screener import PRICE_RULE

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


def _bars(closes: list[Decimal], volume: str) -> list[dict]:
    start = datetime(2024, 1, 1, tzinfo=timezone.utc)
    bars = []
    for index, close in enumerate(closes):
        price = format(close, "f")
        bars.append(
            {
                "bar_index": index,
                "bar_time": (start + timedelta(days=index)).isoformat(),
                "open": price,
                "high": price,
                "low": price,
                "close": price,
                "volume": volume,
            }
        )
    return bars


def test_screener_matches_python_and_stays_inside_the_organization():
    closes = fixture_closes()
    flat = [Decimal("50")] * len(closes)
    expected = screen(
        [
            ScreenerSeries("NONE", "BETA", tuple(flat), tuple(Decimal("10") for _ in flat)),
            ScreenerSeries("NONE", "ACME", tuple(closes), tuple(Decimal("1000") for _ in closes)),
        ],
        PRICE_RULE,
    )
    screener_id = None

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

    other = psycopg2.connect(APP_DSN)
    other.autocommit = False
    try:
        as_user(other, USER_C)
        with other.cursor() as cur:
            cur.execute("SELECT public.finance_create_instrument(%s, %s, %s)", (ORG_B, "GAMMA", "Gamma"))
            gamma_id = cur.fetchone()[0]
            cur.execute(
                "SELECT public.finance_replace_market_bars(%s, %s::jsonb)",
                (gamma_id, json.dumps(_bars(closes, "1000"))),
            )
            cur.fetchone()
        other.commit()
    finally:
        other.close()

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
            cur.execute("SAVEPOINT invalid_screen")
            with pytest.raises(psycopg2.Error):
                cur.execute(
                    "SELECT public.finance_create_screener(%s, %s, %s::jsonb)",
                    (ORG_A, "Bad", json.dumps({"version": 1, "where": {"all": []}, "broker": "live"})),
                )
            cur.execute("ROLLBACK TO SAVEPOINT invalid_screen")
            cur.execute(
                "SELECT public.finance_create_screener(%s, %s, %s::jsonb)",
                (ORG_A, "Liquid rise", json.dumps(PRICE_RULE)),
            )
            screener_id = cur.fetchone()[0]
            cur.execute("SELECT public.finance_run_screener(%s)", (screener_id,))
            run_id = cur.fetchone()[0]
            cur.execute(
                """
                SELECT exchange, symbol, close, volume
                FROM public.finance_screener_candidates
                WHERE run_id = %s
                ORDER BY exchange, symbol
                """,
                (run_id,),
            )
            assert cur.fetchall() == [
                (item.exchange, item.symbol, item.close, item.volume) for item in expected.candidates
            ]
            cur.execute(
                "SELECT candidate_count, result_digest FROM public.finance_screener_runs WHERE id = %s",
                (run_id,),
            )
            assert cur.fetchone() == (len(expected.candidates), expected.digest)
            cur.execute("SELECT public.finance_run_screener(%s)", (screener_id,))
            rerun_id = cur.fetchone()[0]
            cur.execute("SELECT result_digest FROM public.finance_screener_runs WHERE id = %s", (rerun_id,))
            assert cur.fetchone()[0] == expected.digest
            cur.execute("SAVEPOINT candidate_update")
            with pytest.raises(psycopg2.Error):
                cur.execute(
                    "UPDATE public.finance_screener_candidates SET close = 0 WHERE run_id = %s",
                    (rerun_id,),
                )
            cur.execute("ROLLBACK TO SAVEPOINT candidate_update")
        member.commit()
    finally:
        member.close()

    outsider = psycopg2.connect(APP_DSN)
    outsider.autocommit = False
    try:
        as_user(outsider, USER_C)
        with outsider.cursor() as cur:
            cur.execute("SELECT count(*) FROM public.finance_screener_candidates")
            assert cur.fetchone()[0] == 0
        outsider.rollback()
    finally:
        outsider.close()

    viewer = psycopg2.connect(APP_DSN)
    viewer.autocommit = False
    try:
        as_user(viewer, USER_D)
        with viewer.cursor() as cur:
            cur.execute("SELECT symbol FROM public.finance_screener_candidates ORDER BY symbol")
            assert cur.fetchall() == [("ACME",)]
            with pytest.raises(psycopg2.Error):
                cur.execute("SELECT public.finance_run_screener(%s)", (screener_id,))
        viewer.rollback()
    finally:
        viewer.close()

import json
import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import psycopg2
import pytest

from domain.strategies import V2_LONG_RULE
from engine.dsl import execute_spec
from engine.fixture import fixture_closes

SUPER_DSN = os.environ.get("DB_URL_SUPERUSER")
APP_DSN = os.environ.get("DB_URL_APPUSER")

USER_A = "11111111-1111-1111-1111-111111111111"
USER_B = "22222222-2222-2222-2222-222222222222"
USER_C = "33333333-3333-3333-3333-333333333333"
USER_D = "44444444-4444-4444-4444-444444444444"
ORG_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
ORG_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"

EMA_OR_RULE = {
    "version": 2,
    "entry": {
        "any": [
            {"op": "gt", "left": {"ema": 10}, "right": {"sma": 20}},
            {"op": "gt", "left": {"close": True}, "right": {"value": 100000}},
        ]
    },
    "exit": {"all": [{"op": "lt", "left": {"ema": 10}, "right": {"sma": 20}}]},
}

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


def _bars() -> list[dict]:
    start = datetime(2024, 1, 1, tzinfo=timezone.utc)
    bars = []
    for index, close in enumerate(fixture_closes()):
        price = format(close, "f")
        bars.append(
            {
                "bar_index": index,
                "bar_time": (start + timedelta(days=index)).isoformat(),
                "open": price,
                "high": price,
                "low": price,
                "close": price,
                "volume": "1000",
            }
        )
    return bars


def test_version_two_spec_executes_like_the_python_engine():
    closes = fixture_closes()
    expected = execute_spec(closes, V2_LONG_RULE)
    expected_or = execute_spec(closes, EMA_OR_RULE)
    bars = _bars()

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
            cur.execute("SELECT public.finance_create_instrument(%s, %s, %s)", (ORG_A, "ACME", "Acme"))
            instrument_id = cur.fetchone()[0]
            cur.execute(
                "SELECT public.finance_replace_market_bars(%s, %s::jsonb)",
                (instrument_id, json.dumps(bars)),
            )
            cur.fetchone()
            cur.execute("SAVEPOINT invalid_spec")
            with pytest.raises(psycopg2.Error):
                cur.execute(
                    "SELECT public.finance_create_strategy(%s, %s, %s::jsonb)",
                    (
                        instrument_id,
                        "Bad",
                        json.dumps(
                            {
                                "version": 2,
                                "entry": {"all": [{"op": "gt", "left": {"sma": 1}, "right": {"value": 1}}]},
                                "exit": {"all": [{"op": "lt", "left": {"sma": 2}, "right": {"value": 1}}]},
                            }
                        ),
                    ),
                )
            cur.execute("ROLLBACK TO SAVEPOINT invalid_spec")
            cur.execute(
                "SELECT public.finance_create_strategy(%s, %s, %s::jsonb)",
                (instrument_id, "DSL long", json.dumps(V2_LONG_RULE)),
            )
            strategy_id = cur.fetchone()[0]
            cur.execute("SAVEPOINT free_update")
            with pytest.raises(psycopg2.Error):
                cur.execute(
                    "UPDATE public.finance_strategies SET spec = '{}'::jsonb WHERE id = %s",
                    (strategy_id,),
                )
            cur.execute("ROLLBACK TO SAVEPOINT free_update")
            cur.execute("SELECT public.finance_validate_strategy(%s)", (strategy_id,))
            cur.execute("SAVEPOINT v1_backtest")
            with pytest.raises(psycopg2.Error):
                cur.execute("SELECT public.finance_run_backtest(%s)", (strategy_id,))
            cur.execute("ROLLBACK TO SAVEPOINT v1_backtest")
            with pytest.raises(psycopg2.Error):
                cur.execute("SELECT public.finance_run_backtest_v1_body(%s)", (strategy_id,))
            cur.execute("ROLLBACK TO SAVEPOINT v1_backtest")
            cur.execute("SELECT public.finance_execute_strategy(%s)", (strategy_id,))
            run_id = cur.fetchone()[0]
            cur.execute(
                """
                SELECT bar_index, entry_on, exit_on, position
                FROM public.finance_spec_signals
                WHERE run_id = %s
                ORDER BY bar_index
                """,
                (run_id,),
            )
            stored = [(index, entry, exit_on, position) for index, entry, exit_on, position in cur.fetchall()]
            assert stored == [(signal.bar_index, signal.entry_on, signal.exit_on, signal.position) for signal in expected]
            cur.execute(
                "SELECT public.finance_create_strategy(%s, %s, %s::jsonb)",
                (instrument_id, "EMA or", json.dumps(EMA_OR_RULE)),
            )
            or_id = cur.fetchone()[0]
            cur.execute("SELECT public.finance_validate_strategy(%s)", (or_id,))
            cur.execute("SELECT public.finance_execute_strategy(%s)", (or_id,))
            or_run = cur.fetchone()[0]
            cur.execute(
                """
                SELECT bar_index, entry_on, exit_on, position
                FROM public.finance_spec_signals
                WHERE run_id = %s
                ORDER BY bar_index
                """,
                (or_run,),
            )
            stored_or = [(index, entry, exit_on, position) for index, entry, exit_on, position in cur.fetchall()]
            assert stored_or == [
                (signal.bar_index, signal.entry_on, signal.exit_on, signal.position) for signal in expected_or
            ]
        member.commit()
    finally:
        member.close()

    outsider = psycopg2.connect(APP_DSN)
    outsider.autocommit = False
    try:
        as_user(outsider, USER_C)
        with outsider.cursor() as cur:
            cur.execute("SELECT count(*) FROM public.finance_spec_signals")
            assert cur.fetchone()[0] == 0
        outsider.rollback()
    finally:
        outsider.close()

    viewer = psycopg2.connect(APP_DSN)
    viewer.autocommit = False
    try:
        as_user(viewer, USER_D)
        with viewer.cursor() as cur:
            cur.execute("SELECT count(*) FROM public.finance_strategies")
            assert cur.fetchone()[0] == 2
            with pytest.raises(psycopg2.Error):
                cur.execute("SELECT public.finance_execute_strategy(%s)", (strategy_id,))
        viewer.rollback()
    finally:
        viewer.close()

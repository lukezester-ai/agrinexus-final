import json
import os

import psycopg2
import pytest

from domain.strategies import V2_LONG_RULE
from engine.copilot import compile_model_output, specification_digest
from engine.dsl import validate_spec
from engine.test_copilot import SENTENCE

SUPER_DSN = os.environ.get("DB_URL_SUPERUSER")
APP_DSN = os.environ.get("DB_URL_APPUSER")

USER_B = "22222222-2222-2222-2222-222222222222"

pytestmark = pytest.mark.skipif(
    not SUPER_DSN or not APP_DSN,
    reason="DB_URL_SUPERUSER and DB_URL_APPUSER are required",
)


def _as_user(conn, user_id: str) -> None:
    claims = json.dumps({"sub": user_id, "role": "authenticated", "aud": "authenticated"})
    with conn.cursor() as cur:
        cur.execute(
            "SELECT set_config('request.jwt.claim.sub', %s, true), set_config('request.jwt.claims', %s, true)",
            (user_id, claims),
        )
        cur.fetchone()


def test_database_compiler_matches_python_and_writes_nothing():
    expected = compile_model_output(SENTENCE, V2_LONG_RULE)
    assert expected.spec == validate_spec(V2_LONG_RULE)
    assert expected.digest == specification_digest(expected.spec)
    rejected = (
        {"action": "buy", "broker": "live"},
        {"version": 2, "entry": {"all": []}, "exit": {"all": []}, "broker": "live"},
        {"version": 2, "entry": {"all": [{"op": "gt", "left": {"sma": 20}, "right": {"sma": 50}}]}},
        {
            "version": 2,
            "entry": {"all": [{"op": "gt", "left": {"macd": 12}, "right": {"value": 0}}]},
            "exit": {"all": [{"op": "lt", "left": {"close": True}, "right": {"value": 0}}]},
        },
        {
            "version": 2,
            "entry": {"all": [{"op": "crosses", "left": {"sma": 20}, "right": {"sma": 50}}]},
            "exit": {"all": [{"op": "lt", "left": {"close": True}, "right": {"value": 0}}]},
        },
        {
            "version": 2,
            "entry": {"all": [{"op": "gt", "left": {"sma": True}, "right": {"sma": 50}}]},
            "exit": {"all": [{"op": "lt", "left": {"close": True}, "right": {"value": 0}}]},
        },
    )

    with psycopg2.connect(SUPER_DSN) as admin, admin.cursor() as cur:
        cur.execute(
            """
            SELECT count(*)
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname ~* 'broker|execution_gateway|live_order|copilot|openai'
            """
        )
        assert cur.fetchone()[0] == 0
        cur.execute(
            """
            SELECT prosrc
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname = 'finance_compile_strategy_candidate'
            """
        )
        source = cur.fetchone()[0]
        for name in (
            "finance_execute_strategy",
            "finance_run_spec_backtest",
            "finance_run_snapshot_strategy",
            "finance_apply_paper_book",
            "finance_replace_market_bars",
            "finance_capture_snapshot",
            "INSERT",
            "UPDATE",
            "DELETE",
        ):
            assert name not in source
        cur.execute("TRUNCATE public.organizations CASCADE")

    member = psycopg2.connect(APP_DSN)
    member.autocommit = False
    try:
        _as_user(member, USER_B)
        with member.cursor() as cur:
            cur.execute(
                "SELECT spec, digest FROM public.finance_compile_strategy_candidate(%s::jsonb)",
                (json.dumps(V2_LONG_RULE),),
            )
            spec, digest = cur.fetchone()
            if isinstance(spec, str):
                spec = json.loads(spec)
            assert spec == expected.spec
            assert digest == expected.digest
            cur.execute(
                "SELECT spec, digest FROM public.finance_compile_strategy_candidate(%s::jsonb)",
                (json.dumps(V2_LONG_RULE),),
            )
            again_spec, again_digest = cur.fetchone()
            if isinstance(again_spec, str):
                again_spec = json.loads(again_spec)
            assert again_spec == spec
            assert again_digest == digest
            for candidate in rejected:
                cur.execute("SAVEPOINT rejected_candidate")
                with pytest.raises(psycopg2.Error):
                    cur.execute(
                        "SELECT spec, digest FROM public.finance_compile_strategy_candidate(%s::jsonb)",
                        (json.dumps(candidate),),
                    )
                cur.execute("ROLLBACK TO SAVEPOINT rejected_candidate")
            for table in (
                "finance_strategies",
                "finance_spec_books",
                "finance_spec_runs",
                "finance_trade_ledger",
                "finance_performance_stats",
                "finance_paper_portfolios",
                "finance_paper_positions",
                "finance_paper_trades",
                "finance_paper_allocations",
                "finance_market_bars",
                "finance_market_snapshots",
                "finance_audit_log",
            ):
                cur.execute(f"SELECT count(*) FROM public.{table}")
                assert cur.fetchone()[0] == 0
        member.commit()
    finally:
        member.close()

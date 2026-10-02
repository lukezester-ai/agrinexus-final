import json
import os
from decimal import Decimal

import psycopg2
import pytest

from domain.strategies import V2_LONG_RULE
from engine.book import run_spec_book
from engine.copilot import compile_model_output
from engine.fixture import fixture_closes
from engine.test_copilot import SENTENCE
from test_book_gate import _assert_book
from test_integration_gate import (
    ORG_A,
    ORG_B,
    PRICE_RULE,
    USER_A,
    USER_B,
    USER_C,
    USER_D,
    _bars,
    _link,
    _paper_digest,
    _strategy_digest,
    as_user,
)

SUPER_DSN = os.environ.get("DB_URL_SUPERUSER")
APP_DSN = os.environ.get("DB_URL_APPUSER")

pytestmark = pytest.mark.skipif(
    not SUPER_DSN or not APP_DSN,
    reason="DB_URL_SUPERUSER and DB_URL_APPUSER are required",
)


def _json(value):
    if isinstance(value, str):
        return json.loads(value)
    return value


def test_compiled_strategy_matches_the_manual_strategy():
    closes = fixture_closes()
    flat = [Decimal("50")] * len(closes)
    later = closes + [closes[-1] + Decimal("0.20")]
    expected = run_spec_book(closes, V2_LONG_RULE)
    compiled = compile_model_output(SENTENCE, V2_LONG_RULE)
    strategy_digest = _strategy_digest(closes, V2_LONG_RULE)
    paper_digest = _paper_digest(expected)
    rejected = {"action": "buy", "broker": "live"}

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
            SELECT p.proname, p.prosrc
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname IN (
                'finance_compile_strategy_candidate',
                'finance_run_compiled_strategy'
              )
            """
        )
        sources = dict(cur.fetchall())
        compiler = sources["finance_compile_strategy_candidate"]
        runner = sources["finance_run_compiled_strategy"]
        for name in (
            "finance_execute_strategy",
            "finance_run_spec_backtest",
            "finance_run_snapshot_strategy",
            "finance_apply_paper_book",
            "finance_create_strategy",
            "INSERT",
            "UPDATE",
            "DELETE",
        ):
            assert name not in compiler
        for name in (
            "finance_compile_strategy_candidate",
            "finance_create_strategy",
            "finance_validate_strategy",
            "finance_run_snapshot_strategy",
        ):
            assert name in runner
        for name in (
            "finance_execute_strategy",
            "finance_run_spec_backtest",
            "finance_apply_paper_book",
            "sma",
            "rsi",
            "broker",
        ):
            assert name not in runner
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
            cur.execute("SELECT public.finance_capture_snapshot(%s, NULL)", (screener_id,))
            snapshot_id = cur.fetchone()[0]

            cur.execute(
                """
                SELECT public.finance_run_compiled_strategy(%s, %s, %s, %s::jsonb)
                """,
                (snapshot_id, acme_id, "Compiled long", json.dumps(V2_LONG_RULE)),
            )
            compiled_link = cur.fetchone()[0]
            compiled_row = _link(cur, compiled_link)
            compiled_book = compiled_row[0]
            assert compiled_row[1:] == (
                len(closes) - 1,
                compiled_row[2],
                strategy_digest,
                expected.digest,
                paper_digest,
            )
            _assert_book(cur, compiled_book, expected)
            cur.execute(
                """
                SELECT strategies.spec
                FROM public.finance_snapshot_strategy_runs runs
                JOIN public.finance_strategies strategies ON strategies.id = runs.strategy_id
                WHERE runs.id = %s
                """,
                (compiled_link,),
            )
            assert _json(cur.fetchone()[0]) == compiled.spec
            cur.execute(
                "SELECT digest FROM public.finance_compile_strategy_candidate(%s::jsonb)",
                (json.dumps(V2_LONG_RULE),),
            )
            assert cur.fetchone()[0] == compiled.digest

            cur.execute(
                "SELECT public.finance_create_strategy(%s, %s, %s::jsonb)",
                (acme_id, "Manual long", json.dumps(V2_LONG_RULE)),
            )
            manual_id = cur.fetchone()[0]
            cur.execute("SELECT public.finance_validate_strategy(%s)", (manual_id,))
            cur.fetchone()
            cur.execute(
                "SELECT public.finance_run_snapshot_strategy(%s, %s)",
                (snapshot_id, manual_id),
            )
            manual_row = _link(cur, cur.fetchone()[0])
            assert manual_row[1:] == compiled_row[1:]
            _assert_book(cur, manual_row[0], expected)

            cur.execute(
                """
                SELECT public.finance_run_compiled_strategy(%s, %s, %s, %s::jsonb)
                """,
                (snapshot_id, acme_id, "Compiled long again", json.dumps(V2_LONG_RULE)),
            )
            again = _link(cur, cur.fetchone()[0])
            assert again[1:] == compiled_row[1:]

            cur.execute(
                "SELECT public.finance_open_paper_portfolio(%s, %s, %s)",
                (ORG_A, "Compiled book", 100000),
            )
            compiled_portfolio = cur.fetchone()[0]
            cur.execute(
                "SELECT public.finance_apply_paper_book(%s, %s)",
                (compiled_portfolio, compiled_book),
            )
            assert cur.fetchone()[0] == expected.stats.paper_pnl
            cur.execute(
                "SELECT public.finance_open_paper_portfolio(%s, %s, %s)",
                (ORG_A, "Manual book", 100000),
            )
            manual_portfolio = cur.fetchone()[0]
            cur.execute(
                "SELECT public.finance_apply_paper_book(%s, %s)",
                (manual_portfolio, manual_row[0]),
            )
            assert cur.fetchone()[0] == expected.stats.paper_pnl
            cur.execute(
                """
                SELECT cash, quantity, avg_price, mark_price, market_value, cash_weight, position_weight, equity
                FROM public.finance_paper_allocations
                WHERE portfolio_id = %s
                """,
                (compiled_portfolio,),
            )
            compiled_allocation = cur.fetchone()
            cur.execute(
                """
                SELECT cash, quantity, avg_price, mark_price, market_value, cash_weight, position_weight, equity
                FROM public.finance_paper_allocations
                WHERE portfolio_id = %s
                """,
                (manual_portfolio,),
            )
            assert cur.fetchone() == compiled_allocation
            cur.execute("SAVEPOINT applied_strategy")
            with pytest.raises(psycopg2.Error):
                cur.execute(
                    "SELECT public.finance_run_snapshot_strategy(%s, %s)",
                    (snapshot_id, manual_id),
                )
            cur.execute("ROLLBACK TO SAVEPOINT applied_strategy")

            cur.execute(
                "SELECT public.finance_replace_market_bars(%s, %s::jsonb)",
                (acme_id, json.dumps(_bars(later, "1000"))),
            )
            cur.fetchone()
            cur.execute(
                """
                SELECT public.finance_run_compiled_strategy(%s, %s, %s, %s::jsonb)
                """,
                (snapshot_id, acme_id, "Compiled after cutoff", json.dumps(V2_LONG_RULE)),
            )
            held_id = cur.fetchone()[0]
            held = _link(cur, held_id)
            assert held[1:] == compiled_row[1:]
            cur.execute(
                """
                SELECT runs.bar_count
                FROM public.finance_snapshot_strategy_runs links
                JOIN public.finance_spec_runs runs ON runs.strategy_id = links.strategy_id
                WHERE links.id = %s
                """,
                (held_id,),
            )
            assert cur.fetchone()[0] == len(closes)

            cur.execute("SELECT count(*) FROM public.finance_strategies")
            before_reject = cur.fetchone()[0]
            cur.execute("SAVEPOINT rejected_command")
            with pytest.raises(psycopg2.Error):
                cur.execute(
                    """
                    SELECT public.finance_run_compiled_strategy(%s, %s, %s, %s::jsonb)
                    """,
                    (snapshot_id, acme_id, "Live command", json.dumps(rejected)),
                )
            cur.execute("ROLLBACK TO SAVEPOINT rejected_command")
            cur.execute("SELECT count(*) FROM public.finance_strategies")
            assert cur.fetchone()[0] == before_reject
            cur.execute("SAVEPOINT excluded_instrument")
            with pytest.raises(psycopg2.Error):
                cur.execute(
                    """
                    SELECT public.finance_run_compiled_strategy(%s, %s, %s, %s::jsonb)
                    """,
                    (snapshot_id, beta_id, "Beta compiled", json.dumps(V2_LONG_RULE)),
                )
            cur.execute("ROLLBACK TO SAVEPOINT excluded_instrument")
            cur.execute("SELECT count(*) FROM public.finance_strategies")
            assert cur.fetchone()[0] == before_reject
        member.commit()
    finally:
        member.close()

    viewer = psycopg2.connect(APP_DSN)
    viewer.autocommit = False
    try:
        as_user(viewer, USER_D)
        with viewer.cursor() as cur:
            cur.execute("SELECT count(*) FROM public.finance_snapshot_strategy_runs")
            assert cur.fetchone()[0] > 0
            cur.execute("SAVEPOINT viewer_compiled")
            with pytest.raises(psycopg2.Error):
                cur.execute(
                    """
                    SELECT public.finance_run_compiled_strategy(%s, %s, %s, %s::jsonb)
                    """,
                    (snapshot_id, acme_id, "Viewer compiled", json.dumps(V2_LONG_RULE)),
                )
            cur.execute("ROLLBACK TO SAVEPOINT viewer_compiled")
        viewer.commit()
    finally:
        viewer.close()

    outsider = psycopg2.connect(APP_DSN)
    outsider.autocommit = False
    try:
        as_user(outsider, USER_C)
        with outsider.cursor() as cur:
            cur.execute("SELECT count(*) FROM public.finance_snapshot_strategy_runs")
            assert cur.fetchone()[0] == 0
            cur.execute("SELECT count(*) FROM public.finance_spec_books")
            assert cur.fetchone()[0] == 0
            cur.execute("SAVEPOINT outsider_compiled")
            with pytest.raises(psycopg2.Error):
                cur.execute(
                    """
                    SELECT public.finance_run_compiled_strategy(%s, %s, %s, %s::jsonb)
                    """,
                    (snapshot_id, acme_id, "Outsider compiled", json.dumps(V2_LONG_RULE)),
                )
            cur.execute("ROLLBACK TO SAVEPOINT outsider_compiled")
        outsider.commit()
    finally:
        outsider.close()

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
from test_book_gate import _allow_evaluation, _assert_book
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
    _strategy_digest,
    as_user,
)

SUPER_DSN = os.environ.get("DB_URL_SUPERUSER")
APP_DSN = os.environ.get("DB_URL_APPUSER")
USER_ADMIN = "55555555-5555-5555-5555-555555555555"

pytestmark = pytest.mark.skipif(
    not SUPER_DSN or not APP_DSN,
    reason="DB_URL_SUPERUSER and DB_URL_APPUSER are required",
)


def _json(value):
    if isinstance(value, str):
        return json.loads(value)
    return value


def _error_text(error: BaseException) -> str:
    return getattr(error, "pgerror", None) or str(error)


def _assert_apply_denied(book_id: str, name: str, stored_digests: tuple) -> None:
    conn = psycopg2.connect(APP_DSN)
    conn.autocommit = False
    try:
        as_user(conn, USER_A)
        with conn.cursor() as cur:
            cur.execute(
                "SELECT public.finance_open_paper_portfolio(%s, %s, %s)",
                (ORG_A, name, 100000),
            )
            portfolio_id = cur.fetchone()[0]
            cur.execute("SAVEPOINT mismatched")
            with pytest.raises(psycopg2.Error) as mismatched:
                cur.execute(
                    "SELECT public.finance_apply_paper_book(%s, %s)",
                    (portfolio_id, book_id),
                )
            assert "strategy approval does not match" in _error_text(mismatched.value)
            cur.execute("ROLLBACK TO SAVEPOINT mismatched")
            cur.execute(
                "SELECT count(*) FROM public.finance_paper_allocations WHERE book_id = %s",
                (book_id,),
            )
            assert cur.fetchone()[0] == 0
            cur.execute(
                """
                SELECT specification_digest, backtest_digest, risk_digest
                FROM public.finance_strategy_approvals
                WHERE book_id = %s
                """,
                (book_id,),
            )
            assert cur.fetchone() == stored_digests
        conn.commit()
    finally:
        conn.close()


def test_paper_requires_a_human_approval_of_the_result_digests():
    closes = fixture_closes()
    flat = [Decimal("50")] * len(closes)
    expected = run_spec_book(closes, V2_LONG_RULE)
    compiled = compile_model_output(SENTENCE, V2_LONG_RULE)
    strategy_digest = _strategy_digest(closes, V2_LONG_RULE)
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
                'finance_run_compiled_strategy',
                'finance_approve_strategy_result'
              )
            """
        )
        sources = dict(cur.fetchall())
        for name in (
            "finance_approve_strategy_result",
            "finance_strategy_approvals",
            "finance_apply_paper_book",
        ):
            assert name not in sources["finance_compile_strategy_candidate"]
            assert name not in sources["finance_run_compiled_strategy"]
        approve_source = sources["finance_approve_strategy_result"]
        for name in ("finance_apply_paper_book", "finance_run_snapshot_strategy", "broker"):
            assert name not in approve_source
        assert "auth.uid()" in approve_source
        cur.execute(
            """
            SELECT count(*)
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'finance_strategy_approvals'
              AND column_name = 'approved'
            """
        )
        assert cur.fetchone()[0] == 0
        cur.execute("TRUNCATE public.organizations CASCADE")
        cur.execute(
            "INSERT INTO public.organizations (id, name, owner_user_id) VALUES (%s, 'Fund A', %s), (%s, 'Fund B', %s)",
            (ORG_A, USER_A, ORG_B, USER_C),
        )
        cur.execute(
            """
            INSERT INTO public.organization_memberships (organization_id, user_id, role)
            VALUES (%s,%s,'owner'),(%s,%s,'admin'),(%s,%s,'member'),(%s,%s,'viewer'),(%s,%s,'owner')
            """,
            (ORG_A, USER_A, ORG_A, USER_ADMIN, ORG_A, USER_B, ORG_A, USER_D, ORG_B, USER_C),
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
                "SELECT public.finance_run_compiled_strategy(%s, %s, %s, %s::jsonb)",
                (snapshot_id, acme_id, "Compiled member", json.dumps(V2_LONG_RULE)),
            )
            member_book = _link(cur, cur.fetchone()[0])[0]
            cur.execute(
                "SELECT public.finance_run_compiled_strategy(%s, %s, %s, %s::jsonb)",
                (snapshot_id, acme_id, "Compiled admin", json.dumps(V2_LONG_RULE)),
            )
            admin_book = _link(cur, cur.fetchone()[0])[0]
            cur.execute(
                "SELECT public.finance_create_strategy(%s, %s, %s::jsonb)",
                (acme_id, "Manual owner", json.dumps(V2_LONG_RULE)),
            )
            manual_id = cur.fetchone()[0]
            cur.execute("SELECT public.finance_validate_strategy(%s)", (manual_id,))
            cur.fetchone()
            cur.execute(
                "SELECT public.finance_run_snapshot_strategy(%s, %s)",
                (snapshot_id, manual_id),
            )
            owner_book = _link(cur, cur.fetchone()[0])[0]
            _assert_book(cur, member_book, expected)
            _assert_book(cur, admin_book, expected)
            _assert_book(cur, owner_book, expected)
            cur.execute("SELECT count(*) FROM public.finance_strategy_approvals")
            assert cur.fetchone()[0] == 0
            cur.execute("SELECT result_digest FROM public.finance_spec_books WHERE id = %s", (member_book,))
            assert cur.fetchone()[0] == expected.digest
            cur.execute("SELECT result_digest FROM public.finance_spec_books WHERE id = %s", (admin_book,))
            assert cur.fetchone()[0] == expected.digest

            cur.execute(
                "SELECT public.finance_open_paper_portfolio(%s, %s, %s)",
                (ORG_A, "Unapproved", 100000),
            )
            denied_portfolio = cur.fetchone()[0]
            cur.execute("SAVEPOINT unapproved")
            with pytest.raises(psycopg2.Error) as denied:
                cur.execute(
                    "SELECT public.finance_apply_paper_book(%s, %s)",
                    (denied_portfolio, member_book),
                )
            assert "strategy approval is required" in _error_text(denied.value)
            cur.execute("ROLLBACK TO SAVEPOINT unapproved")
            cur.execute(
                "SELECT count(*) FROM public.finance_paper_allocations WHERE portfolio_id = %s",
                (denied_portfolio,),
            )
            assert cur.fetchone()[0] == 0

            cur.execute("SAVEPOINT viewer_approve")
            as_user(member, USER_D)
            with pytest.raises(psycopg2.Error) as viewer_denied:
                cur.execute("SELECT public.finance_approve_strategy_result(%s)", (member_book,))
            assert "not an organization writer" in _error_text(viewer_denied.value)
            cur.execute("ROLLBACK TO SAVEPOINT viewer_approve")

            cur.execute("SAVEPOINT outsider_approve")
            as_user(member, USER_C)
            with pytest.raises(psycopg2.Error) as outsider_denied:
                cur.execute("SELECT public.finance_approve_strategy_result(%s)", (member_book,))
            assert "not an organization writer" in _error_text(outsider_denied.value)
            cur.execute("ROLLBACK TO SAVEPOINT outsider_approve")

            cur.execute("SAVEPOINT rejected_command")
            as_user(member, USER_B)
            with pytest.raises(psycopg2.Error):
                cur.execute(
                    "SELECT public.finance_run_compiled_strategy(%s, %s, %s, %s::jsonb)",
                    (snapshot_id, acme_id, "Live command", json.dumps(rejected)),
                )
            cur.execute("ROLLBACK TO SAVEPOINT rejected_command")
            cur.execute("SELECT count(*) FROM public.finance_strategy_approvals")
            assert cur.fetchone()[0] == 0

            as_user(member, USER_B)
            _allow_evaluation(cur, member_book)
            _allow_evaluation(cur, admin_book)
            _allow_evaluation(cur, owner_book)
            cur.execute("SELECT public.finance_approve_strategy_result(%s)", (member_book,))
            member_approval = cur.fetchone()[0]
            as_user(member, USER_ADMIN)
            cur.execute("SELECT public.finance_approve_strategy_result(%s)", (admin_book,))
            cur.fetchone()
            as_user(member, USER_A)
            cur.execute("SELECT public.finance_approve_strategy_result(%s)", (owner_book,))
            cur.fetchone()
            as_user(member, USER_B)

            cur.execute(
                """
                SELECT organization_id, specification_digest, strategy_digest, backtest_digest,
                       risk_digest, approved_by, approved_at
                FROM public.finance_strategy_approvals
                WHERE id = %s
                """,
                (member_approval,),
            )
            (
                organization_id,
                spec_digest,
                signal_digest,
                backtest_digest,
                risk_digest,
                approved_by,
                approved_at,
            ) = cur.fetchone()
            assert organization_id == ORG_A
            assert spec_digest == compiled.digest
            assert signal_digest == strategy_digest
            assert backtest_digest == expected.digest
            assert approved_by == USER_B
            assert approved_at is not None
            cur.execute(
                """
                SELECT specification_digest, strategy_digest, backtest_digest, risk_digest
                FROM public.finance_strategy_approvals
                WHERE book_id = %s
                """,
                (admin_book,),
            )
            assert cur.fetchone() == (spec_digest, signal_digest, backtest_digest, risk_digest)
            cur.execute(
                """
                SELECT actor_user_id, details
                FROM public.finance_audit_log
                WHERE action = 'strategy.approved' AND subject_id = %s
                """,
                (member_approval,),
            )
            actor, details = cur.fetchone()
            assert actor == USER_B
            assert _json(details)["risk_digest"] == risk_digest
            assert _json(details)["backtest_digest"] == expected.digest
            assert _json(details)["strategy_digest"] == strategy_digest

            cur.execute("SAVEPOINT spec_update")
            with pytest.raises(psycopg2.Error):
                cur.execute(
                    "UPDATE public.finance_strategies SET spec = %s::jsonb WHERE id = %s",
                    (json.dumps(V2_LONG_RULE), manual_id),
                )
            cur.execute("ROLLBACK TO SAVEPOINT spec_update")
            cur.execute("SAVEPOINT approval_update")
            with pytest.raises(psycopg2.Error):
                cur.execute(
                    "UPDATE public.finance_strategy_approvals SET risk_digest = %s WHERE id = %s",
                    ("0" * 32, member_approval),
                )
            cur.execute("ROLLBACK TO SAVEPOINT approval_update")
        member.commit()
    finally:
        member.close()

    with psycopg2.connect(SUPER_DSN) as admin, admin.cursor() as cur:
        cur.execute("SAVEPOINT spec_immutable")
        with pytest.raises(psycopg2.Error) as immutable:
            cur.execute(
                """
                UPDATE public.finance_strategies
                SET spec = jsonb_set(spec, '{version}', '3'::jsonb)
                WHERE id = %s
                """,
                (manual_id,),
            )
        assert "approved specification is immutable" in _error_text(immutable.value)
        cur.execute("ROLLBACK TO SAVEPOINT spec_immutable")
        cur.execute("SAVEPOINT approval_immutable")
        with pytest.raises(psycopg2.Error) as approval_immutable:
            cur.execute(
                "UPDATE public.finance_strategy_approvals SET risk_digest = %s WHERE book_id = %s",
                ("0" * 32, owner_book),
            )
        assert "strategy approval is immutable" in _error_text(approval_immutable.value)
        cur.execute("ROLLBACK TO SAVEPOINT approval_immutable")
        cur.execute("SELECT spec FROM public.finance_strategies WHERE id = %s", (manual_id,))
        original_spec = cur.fetchone()[0]
        cur.execute("SELECT result_digest FROM public.finance_spec_books WHERE id = %s", (owner_book,))
        original_backtest = cur.fetchone()[0]
        cur.execute(
            "SELECT max_drawdown FROM public.finance_performance_stats WHERE book_id = %s",
            (owner_book,),
        )
        original_drawdown = cur.fetchone()[0]
        stored_digests = (spec_digest, backtest_digest, risk_digest)
        cur.execute("SET session_replication_role = replica")
        cur.execute(
            """
            UPDATE public.finance_strategies
            SET spec = jsonb_set(spec, '{version}', '3'::jsonb)
            WHERE id = %s
            """,
            (manual_id,),
        )
        cur.execute("SET session_replication_role = origin")
        admin.commit()

    _assert_apply_denied(owner_book, "Changed specification", stored_digests)

    with psycopg2.connect(SUPER_DSN) as admin, admin.cursor() as cur:
        spec_payload = original_spec if isinstance(original_spec, str) else json.dumps(original_spec)
        cur.execute("SET session_replication_role = replica")
        cur.execute(
            "UPDATE public.finance_strategies SET spec = %s::jsonb WHERE id = %s",
            (spec_payload, manual_id),
        )
        cur.execute("SET session_replication_role = origin")
        cur.execute(
            "UPDATE public.finance_spec_books SET result_digest = %s WHERE id = %s",
            ("0" * 32, owner_book),
        )
        admin.commit()

    _assert_apply_denied(owner_book, "Changed backtest", stored_digests)

    with psycopg2.connect(SUPER_DSN) as admin, admin.cursor() as cur:
        cur.execute(
            "UPDATE public.finance_spec_books SET result_digest = %s WHERE id = %s",
            (original_backtest, owner_book),
        )
        cur.execute(
            "UPDATE public.finance_performance_stats SET max_drawdown = max_drawdown + 1 WHERE book_id = %s",
            (owner_book,),
        )
        admin.commit()

    _assert_apply_denied(owner_book, "Changed risk", stored_digests)

    with psycopg2.connect(SUPER_DSN) as admin, admin.cursor() as cur:
        cur.execute(
            "UPDATE public.finance_performance_stats SET max_drawdown = %s WHERE book_id = %s",
            (original_drawdown, owner_book),
        )
        admin.commit()

    applied = psycopg2.connect(APP_DSN)
    applied.autocommit = False
    try:
        as_user(applied, USER_B)
        with applied.cursor() as cur:
            cur.execute(
                "SELECT public.finance_open_paper_portfolio(%s, %s, %s)",
                (ORG_A, "Member book", 100000),
            )
            member_portfolio = cur.fetchone()[0]
            cur.execute(
                "SELECT public.finance_apply_paper_book(%s, %s)",
                (member_portfolio, member_book),
            )
            assert cur.fetchone()[0] == expected.stats.paper_pnl
            as_user(applied, USER_ADMIN)
            cur.execute(
                "SELECT public.finance_open_paper_portfolio(%s, %s, %s)",
                (ORG_A, "Admin book", 100000),
            )
            admin_portfolio = cur.fetchone()[0]
            cur.execute(
                "SELECT public.finance_apply_paper_book(%s, %s)",
                (admin_portfolio, admin_book),
            )
            assert cur.fetchone()[0] == expected.stats.paper_pnl
            as_user(applied, USER_A)
            cur.execute(
                "SELECT public.finance_open_paper_portfolio(%s, %s, %s)",
                (ORG_A, "Owner book", 100000),
            )
            owner_portfolio = cur.fetchone()[0]
            cur.execute(
                "SELECT public.finance_apply_paper_book(%s, %s)",
                (owner_portfolio, owner_book),
            )
            assert cur.fetchone()[0] == expected.stats.paper_pnl
            cur.execute(
                """
                SELECT cash, quantity, equity
                FROM public.finance_paper_allocations
                WHERE portfolio_id IN (%s, %s, %s)
                ORDER BY portfolio_id
                """,
                (member_portfolio, admin_portfolio, owner_portfolio),
            )
            rows = cur.fetchall()
            assert rows[0] == rows[1] == rows[2]
        applied.commit()
    finally:
        applied.close()

    viewer = psycopg2.connect(APP_DSN)
    viewer.autocommit = False
    try:
        as_user(viewer, USER_D)
        with viewer.cursor() as cur:
            cur.execute("SELECT count(*) FROM public.finance_strategy_approvals")
            assert cur.fetchone()[0] == 3
            cur.execute("SAVEPOINT viewer_again")
            with pytest.raises(psycopg2.Error):
                cur.execute("SELECT public.finance_approve_strategy_result(%s)", (member_book,))
            cur.execute("ROLLBACK TO SAVEPOINT viewer_again")
        viewer.commit()
    finally:
        viewer.close()

    outsider = psycopg2.connect(APP_DSN)
    outsider.autocommit = False
    try:
        as_user(outsider, USER_C)
        with outsider.cursor() as cur:
            cur.execute("SELECT count(*) FROM public.finance_strategy_approvals")
            assert cur.fetchone()[0] == 0
            cur.execute("SELECT count(*) FROM public.finance_paper_allocations")
            assert cur.fetchone()[0] == 0
            cur.execute("SAVEPOINT outsider_again")
            with pytest.raises(psycopg2.Error):
                cur.execute("SELECT public.finance_approve_strategy_result(%s)", (member_book,))
            cur.execute("ROLLBACK TO SAVEPOINT outsider_again")
        outsider.commit()
    finally:
        outsider.close()

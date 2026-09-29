import json
import os
from datetime import datetime, timedelta, timezone

import psycopg2
import pytest

from engine.book import run_spec_book
from engine.fixture import fixture_closes
from engine.test_book import ALWAYS_LONG
from test_integration_gate import ORG_A, ORG_B, USER_A, USER_B, USER_C, USER_D, as_user

SUPER_DSN = os.environ.get("DB_URL_SUPERUSER")
APP_DSN = os.environ.get("DB_URL_APPUSER")

pytestmark = pytest.mark.skipif(
    not SUPER_DSN or not APP_DSN,
    reason="DB_URL_SUPERUSER and DB_URL_APPUSER are required",
)


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


def _policy(name: str, **overrides) -> dict:
    document = {
        "max_risk_per_position": 1,
        "max_exposure": 1000000,
        "max_drawdown": 1,
        "max_concurrent_positions": 1,
        "allowed_instruments": ["ACME"],
        "allowed_strategies": [name],
        "forbidden_actions": [],
    }
    document.update(overrides)
    return document


def _error_text(error: BaseException) -> str:
    return getattr(error, "pgerror", None) or str(error)


def _book(cur, instrument_id, name: str):
    cur.execute(
        "SELECT public.finance_create_strategy(%s, %s, %s::jsonb)",
        (instrument_id, name, json.dumps(ALWAYS_LONG)),
    )
    strategy_id = cur.fetchone()[0]
    cur.execute("SELECT public.finance_validate_strategy(%s)", (strategy_id,))
    cur.fetchone()
    cur.execute("SELECT public.finance_execute_strategy(%s)", (strategy_id,))
    cur.fetchone()
    cur.execute("SELECT public.finance_run_spec_backtest(%s)", (strategy_id,))
    return cur.fetchone()[0]


def _evaluate(cur, book_id, policy: dict):
    cur.execute(
        "SELECT public.finance_create_risk_policy(%s, %s::jsonb)",
        (ORG_A, json.dumps(policy)),
    )
    policy_id = cur.fetchone()[0]
    cur.execute("SELECT public.finance_evaluate_risk_policy(%s, %s)", (policy_id, book_id))
    evaluation_id = cur.fetchone()[0]
    cur.execute(
        """
        SELECT accepted, evaluation_digest, policy_digest
        FROM public.finance_risk_evaluations
        WHERE id = %s
        """,
        (evaluation_id,),
    )
    return policy_id, cur.fetchone()


def test_approval_binds_an_allow_evaluation_and_paper_follows_that_digest():
    expected = run_spec_book(fixture_closes(), ALWAYS_LONG)
    with psycopg2.connect(SUPER_DSN) as admin, admin.cursor() as cur:
        cur.execute(
            """
            SELECT p.proname, p.prosrc
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname IN ('finance_approve_strategy_result', 'finance_apply_paper_book')
            """
        )
        sources = dict(cur.fetchall())
        for source in sources.values():
            for name in ("finance_evaluate_risk_policy", "finance_run_spec_backtest", "peak"):
                assert name not in source
        assert "finance_risk_evaluations" in sources["finance_approve_strategy_result"]
        assert "evaluation_digest" in sources["finance_approve_strategy_result"]
        assert "evaluation_digest" in sources["finance_apply_paper_book"]
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
                (instrument_id, json.dumps(_bars())),
            )
            cur.fetchone()
            held = _book(cur, instrument_id, "Open")
            posted = _book(cur, instrument_id, "Hold")

            cur.execute("SAVEPOINT missing_evaluation")
            with pytest.raises(psycopg2.Error) as missing:
                cur.execute("SELECT public.finance_approve_strategy_result(%s)", (held,))
            assert "risk evaluation is required" in _error_text(missing.value)
            cur.execute("ROLLBACK TO SAVEPOINT missing_evaluation")

            deny_policy, (denied, _, _) = _evaluate(cur, held, _policy("Open", max_drawdown=0))
            assert denied is False
            cur.execute("SAVEPOINT denied_evaluation")
            with pytest.raises(psycopg2.Error) as not_allowed:
                cur.execute("SELECT public.finance_approve_strategy_result(%s)", (held,))
            assert "risk evaluation is not allowed" in _error_text(not_allowed.value)
            cur.execute("ROLLBACK TO SAVEPOINT denied_evaluation")
            cur.execute("SELECT count(*) FROM public.finance_strategy_approvals")
            assert cur.fetchone()[0] == 0

            allow = _policy("Open")
            policy_id, (accepted, evaluation_digest, policy_digest) = _evaluate(cur, held, allow)
            assert accepted is True
            cur.execute("SELECT public.finance_approve_strategy_result(%s)", (held,))
            approval_id = cur.fetchone()[0]
            cur.execute(
                """
                SELECT organization_id, evaluation_id IS NOT NULL, evaluation_digest, approved_by
                FROM public.finance_strategy_approvals
                WHERE id = %s
                """,
                (approval_id,),
            )
            assert cur.fetchone() == (ORG_A, True, evaluation_digest, USER_B)
            cur.execute(
                """
                SELECT details->>'evaluation_digest'
                FROM public.finance_audit_log
                WHERE action = 'strategy.approved' AND subject_id = %s
                """,
                (approval_id,),
            )
            assert cur.fetchone()[0] == evaluation_digest

            changed = _policy("Open", max_drawdown=0.5)
            cur.execute(
                "SELECT public.finance_replace_risk_policy(%s, %s::jsonb)",
                (policy_id, json.dumps(changed)),
            )
            cur.fetchone()
            _, (still_allowed, changed_digest, _) = _evaluate(cur, held, changed)
            assert still_allowed is True
            assert changed_digest != evaluation_digest
            cur.execute(
                "SELECT evaluation_digest FROM public.finance_strategy_approvals WHERE id = %s",
                (approval_id,),
            )
            assert cur.fetchone()[0] == evaluation_digest
            cur.execute(
                "SELECT public.finance_open_paper_portfolio(%s, %s, %s)",
                (ORG_A, "Stale", 100000),
            )
            stale_portfolio = cur.fetchone()[0]
            cur.execute("SAVEPOINT stale_policy")
            with pytest.raises(psycopg2.Error) as stale:
                cur.execute(
                    "SELECT public.finance_apply_paper_book(%s, %s)",
                    (stale_portfolio, held),
                )
            assert "strategy approval does not match" in _error_text(stale.value)
            cur.execute("ROLLBACK TO SAVEPOINT stale_policy")
            cur.execute(
                "SELECT count(*) FROM public.finance_paper_allocations WHERE book_id = %s",
                (held,),
            )
            assert cur.fetchone()[0] == 0
            cur.execute(
                "SELECT policy_digest FROM public.finance_risk_policies WHERE id = %s",
                (policy_id,),
            )
            assert cur.fetchone()[0] != policy_digest

            posted_policy, (posted_allowed, posted_digest, _) = _evaluate(cur, posted, _policy("Hold"))
            assert posted_allowed is True
            cur.execute("SELECT public.finance_approve_strategy_result(%s)", (posted,))
            cur.fetchone()
            cur.execute(
                "SELECT public.finance_open_paper_portfolio(%s, %s, %s)",
                (ORG_A, "Held", 100000),
            )
            portfolio_id = cur.fetchone()[0]
            cur.execute("SELECT public.finance_apply_paper_book(%s, %s)", (portfolio_id, posted))
            assert cur.fetchone()[0] == expected.stats.paper_pnl
            cur.execute(
                "SELECT evaluation_digest FROM public.finance_strategy_approvals WHERE book_id = %s",
                (posted,),
            )
            assert cur.fetchone()[0] == posted_digest

            cur.execute("SAVEPOINT viewer_approve")
            as_user(member, USER_D)
            with pytest.raises(psycopg2.Error) as viewer_denied:
                cur.execute("SELECT public.finance_approve_strategy_result(%s)", (posted,))
            assert "not an organization writer" in _error_text(viewer_denied.value)
            cur.execute("ROLLBACK TO SAVEPOINT viewer_approve")
            cur.execute("SAVEPOINT outsider_approve")
            as_user(member, USER_C)
            with pytest.raises(psycopg2.Error) as outsider_denied:
                cur.execute("SELECT public.finance_approve_strategy_result(%s)", (held,))
            assert "not an organization writer" in _error_text(outsider_denied.value)
            cur.execute("ROLLBACK TO SAVEPOINT outsider_approve")
        member.commit()
    finally:
        member.close()

    outsider = psycopg2.connect(APP_DSN)
    outsider.autocommit = False
    try:
        as_user(outsider, USER_C)
        with outsider.cursor() as cur:
            cur.execute("SELECT count(*) FROM public.finance_strategy_approvals")
            assert cur.fetchone()[0] == 0
            cur.execute("SELECT count(*) FROM public.finance_paper_allocations")
            assert cur.fetchone()[0] == 0
        outsider.commit()
    finally:
        outsider.close()

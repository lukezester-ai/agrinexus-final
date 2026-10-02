import json
import os
from datetime import datetime, timedelta, timezone

import psycopg2
import pytest

from engine.book import run_spec_book
from engine.evaluation import evaluate_policy
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


def _policy(**overrides) -> dict:
    document = {
        "max_risk_per_position": 1,
        "max_exposure": 1000000,
        "max_drawdown": 1,
        "max_concurrent_positions": 1,
        "allowed_instruments": ["ACME"],
        "allowed_strategies": ["Open"],
        "forbidden_actions": [],
    }
    document.update(overrides)
    return document


def _expected(policy: dict):
    book = run_spec_book(fixture_closes(), ALWAYS_LONG)
    return evaluate_policy(
        policy,
        "Open",
        "ACME",
        book.stats.max_drawdown,
        book.allocation.market_value,
        book.allocation.position_weight,
        book.allocation.quantity,
        bool(book.ledger),
    )


def _error_text(error: BaseException) -> str:
    return getattr(error, "pgerror", None) or str(error)


def test_policy_evaluation_uses_existing_metrics_and_does_not_touch_approval():
    book = run_spec_book(fixture_closes(), ALWAYS_LONG)
    assert book.stats.max_drawdown > 0
    assert book.allocation.market_value > 0
    assert book.allocation.position_weight > 0
    assert book.allocation.quantity > 0
    allowing = _policy()
    looser = _policy(max_exposure=2000000)
    expected = _expected(allowing)
    expected_looser = _expected(looser)
    assert expected.accepted is True
    assert expected.digest != expected_looser.digest
    denials = (
        (_policy(allowed_strategies=["Closed"]), ("strategy",)),
        (_policy(allowed_instruments=["BETA"]), ("instrument",)),
        (_policy(max_drawdown=0), ("max_drawdown",)),
        (_policy(max_exposure=0), ("max_exposure",)),
        (_policy(max_risk_per_position=0), ("max_risk_per_position",)),
        (_policy(max_concurrent_positions=0), ("max_concurrent_positions",)),
        (_policy(forbidden_actions=["long"]), ("forbidden_action",)),
    )

    with psycopg2.connect(SUPER_DSN) as admin, admin.cursor() as cur:
        cur.execute(
            """
            SELECT p.prosrc
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname = 'finance_evaluate_risk_policy'
            """
        )
        source = cur.fetchone()[0]
        for name in (
            "finance_apply_paper_book",
            "finance_approve_strategy_result",
            "finance_run_spec_backtest",
            "peak",
        ):
            assert name not in source
        cur.execute(
            """
            SELECT p.prosrc
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname = 'finance_approve_strategy_result'
            """
        )
        approval = cur.fetchone()[0]
        assert "finance_evaluate_risk_policy" not in approval
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
            cur.execute(
                "SELECT public.finance_create_strategy(%s, %s, %s::jsonb)",
                (instrument_id, "Open", json.dumps(ALWAYS_LONG)),
            )
            strategy_id = cur.fetchone()[0]
            cur.execute("SELECT public.finance_validate_strategy(%s)", (strategy_id,))
            cur.fetchone()
            cur.execute("SELECT public.finance_execute_strategy(%s)", (strategy_id,))
            cur.fetchone()
            cur.execute("SELECT public.finance_run_spec_backtest(%s)", (strategy_id,))
            book_id = cur.fetchone()[0]
            cur.execute(
                "SELECT public.finance_create_risk_policy(%s, %s::jsonb)",
                (ORG_A, json.dumps(allowing)),
            )
            policy_id = cur.fetchone()[0]
            cur.execute("SELECT public.finance_evaluate_risk_policy(%s, %s)", (policy_id, book_id))
            first_id = cur.fetchone()[0]
            cur.execute("SELECT public.finance_evaluate_risk_policy(%s, %s)", (policy_id, book_id))
            second_id = cur.fetchone()[0]
            cur.execute(
                """
                SELECT organization_id, policy_digest, evaluation_digest, accepted, denials, created_by
                FROM public.finance_risk_evaluations
                WHERE id IN (%s, %s)
                ORDER BY created_at, id
                """,
                (first_id, second_id),
            )
            rows = cur.fetchall()
            assert rows[0][2] == rows[1][2] == expected.digest
            assert rows[0][0] == ORG_A
            assert rows[0][3] is True
            assert rows[0][4] == []
            assert rows[0][5] == USER_B
            cur.execute(
                """
                SELECT actor_user_id, details
                FROM public.finance_audit_log
                WHERE action = 'risk_evaluation.created' AND subject_id = %s
                """,
                (first_id,),
            )
            actor, details = cur.fetchone()
            parsed = json.loads(details) if isinstance(details, str) else details
            assert actor == USER_B
            assert parsed["evaluation_digest"] == expected.digest

            cur.execute(
                "SELECT public.finance_create_risk_policy(%s, %s::jsonb)",
                (ORG_A, json.dumps(looser)),
            )
            looser_id = cur.fetchone()[0]
            cur.execute("SELECT public.finance_evaluate_risk_policy(%s, %s)", (looser_id, book_id))
            looser_eval = cur.fetchone()[0]
            cur.execute(
                "SELECT accepted, evaluation_digest FROM public.finance_risk_evaluations WHERE id = %s",
                (looser_eval,),
            )
            assert cur.fetchone() == (True, expected_looser.digest)

            for policy, denial in denials:
                cur.execute(
                    "SELECT public.finance_create_risk_policy(%s, %s::jsonb)",
                    (ORG_A, json.dumps(policy)),
                )
                denial_policy = cur.fetchone()[0]
                cur.execute(
                    "SELECT public.finance_evaluate_risk_policy(%s, %s)",
                    (denial_policy, book_id),
                )
                denial_id = cur.fetchone()[0]
                cur.execute(
                    "SELECT accepted, denials, evaluation_digest FROM public.finance_risk_evaluations WHERE id = %s",
                    (denial_id,),
                )
                accepted, stored, digest = cur.fetchone()
                result = _expected(policy)
                assert accepted is False
                assert tuple(stored) == denial == result.denials
                assert digest == result.digest

            cur.execute("SELECT count(*) FROM public.finance_strategy_approvals")
            assert cur.fetchone()[0] == 0
            cur.execute("SELECT count(*) FROM public.finance_paper_allocations")
            assert cur.fetchone()[0] == 0

            cur.execute("SAVEPOINT direct_update")
            with pytest.raises(psycopg2.Error):
                cur.execute(
                    "UPDATE public.finance_risk_evaluations SET accepted = false WHERE id = %s",
                    (first_id,),
                )
            cur.execute("ROLLBACK TO SAVEPOINT direct_update")

            cur.execute("SELECT count(*) FROM public.finance_risk_evaluations")
            before = cur.fetchone()[0]
            cur.execute("SAVEPOINT viewer_eval")
            as_user(member, USER_D)
            with pytest.raises(psycopg2.Error) as viewer_denied:
                cur.execute(
                    "SELECT public.finance_evaluate_risk_policy(%s, %s)",
                    (policy_id, book_id),
                )
            assert "not an organization writer" in _error_text(viewer_denied.value)
            cur.execute("ROLLBACK TO SAVEPOINT viewer_eval")
            cur.execute("SELECT count(*) FROM public.finance_risk_evaluations")
            assert cur.fetchone()[0] == before

            cur.execute("SAVEPOINT outsider_eval")
            as_user(member, USER_C)
            with pytest.raises(psycopg2.Error) as outsider_denied:
                cur.execute(
                    "SELECT public.finance_evaluate_risk_policy(%s, %s)",
                    (policy_id, book_id),
                )
            assert "not an organization writer" in _error_text(outsider_denied.value)
            cur.execute("ROLLBACK TO SAVEPOINT outsider_eval")
        member.commit()
    finally:
        member.close()

    outsider = psycopg2.connect(APP_DSN)
    outsider.autocommit = False
    try:
        as_user(outsider, USER_C)
        with outsider.cursor() as cur:
            cur.execute("SELECT count(*) FROM public.finance_risk_evaluations")
            assert cur.fetchone()[0] == 0
            cur.execute("SELECT count(*) FROM public.finance_strategy_approvals")
            assert cur.fetchone()[0] == 0
        outsider.commit()
    finally:
        outsider.close()

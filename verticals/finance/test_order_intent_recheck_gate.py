import json
import os
from datetime import datetime, timedelta, timezone

import psycopg2
import pytest

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


def _prepare(cur, instrument_id, name: str):
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
    book_id = cur.fetchone()[0]
    cur.execute(
        "SELECT public.finance_create_risk_policy(%s, %s::jsonb)",
        (ORG_A, json.dumps(_policy(name))),
    )
    policy_id = cur.fetchone()[0]
    cur.execute("SELECT public.finance_evaluate_risk_policy(%s, %s)", (policy_id, book_id))
    cur.fetchone()
    cur.execute("SELECT public.finance_approve_strategy_result(%s)", (book_id,))
    approval_id = cur.fetchone()[0]
    cur.execute(
        "SELECT public.finance_create_order_intent(%s, %s::jsonb)",
        (approval_id, "{}"),
    )
    intent_id = cur.fetchone()[0]
    cur.execute("SELECT intent_digest FROM public.finance_order_intents WHERE id = %s", (intent_id,))
    return policy_id, intent_id, cur.fetchone()[0]


def test_recheck_compares_the_intent_with_the_current_evaluation():
    with psycopg2.connect(SUPER_DSN) as admin, admin.cursor() as cur:
        cur.execute(
            """
            SELECT count(*)
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname ~* 'broker|execution_gateway|live_order|authoriz'
            """
        )
        assert cur.fetchone()[0] == 0
        cur.execute(
            """
            SELECT p.prosrc
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname = 'finance_recheck_order_intent'
            """
        )
        source = cur.fetchone()[0]
        for name in (
            "finance_evaluate_risk_policy",
            "finance_apply_paper_book",
            "finance_create_order_intent",
            "finance_paper_allocations",
            "peak",
        ):
            assert name not in source
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
            policy_id, intent_id, intent_digest = _prepare(cur, instrument_id, "Open")
            cur.execute("SELECT count(*) FROM public.finance_order_intents")
            assert cur.fetchone()[0] == 1
            cur.execute("SELECT public.finance_recheck_order_intent(%s)", (intent_id,))
            assert cur.fetchone()[0] == intent_id
            cur.execute("SELECT intent_digest FROM public.finance_order_intents WHERE id = %s", (intent_id,))
            assert cur.fetchone()[0] == intent_digest
            cur.execute("SELECT count(*) FROM public.finance_order_intents")
            assert cur.fetchone()[0] == 1
            cur.execute(
                """
                SELECT details->>'intent_digest', details->>'evaluation_digest'
                FROM public.finance_audit_log
                WHERE action = 'order_intent.rechecked' AND subject_id = %s
                """,
                (intent_id,),
            )
            audited = cur.fetchone()
            assert audited[0] == intent_digest
            assert audited[1]

            cur.execute(
                "SELECT public.finance_replace_risk_policy(%s, %s::jsonb)",
                (policy_id, json.dumps(_policy("Open", max_drawdown=0.5))),
            )
            cur.fetchone()
            cur.execute("SAVEPOINT stale_policy")
            with pytest.raises(psycopg2.Error) as stale:
                cur.execute("SELECT public.finance_recheck_order_intent(%s)", (intent_id,))
            assert "order intent does not match" in _error_text(stale.value)
            cur.execute("ROLLBACK TO SAVEPOINT stale_policy")
            cur.execute("SELECT intent_digest FROM public.finance_order_intents WHERE id = %s", (intent_id,))
            assert cur.fetchone()[0] == intent_digest

            cur.execute(
                "SELECT public.finance_replace_risk_policy(%s, %s::jsonb)",
                (policy_id, json.dumps(_policy("Open"))),
            )
            cur.fetchone()
            cur.execute("SELECT public.finance_recheck_order_intent(%s)", (intent_id,))
            assert cur.fetchone()[0] == intent_id

            other_policy, other_intent, other_digest = _prepare(cur, instrument_id, "Hold")
            cur.execute(
                "SELECT public.finance_replace_risk_policy(%s, %s::jsonb)",
                (other_policy, json.dumps(_policy("Hold", max_drawdown=0.5))),
            )
            cur.fetchone()
            cur.execute(
                "SELECT book_id FROM public.finance_order_intents WHERE id = %s",
                (other_intent,),
            )
            other_book = cur.fetchone()[0]
            cur.execute(
                "SELECT public.finance_evaluate_risk_policy(%s, %s)",
                (other_policy, other_book),
            )
            cur.fetchone()
            cur.execute("SAVEPOINT changed_evaluation")
            with pytest.raises(psycopg2.Error) as changed:
                cur.execute("SELECT public.finance_recheck_order_intent(%s)", (other_intent,))
            assert "order intent does not match" in _error_text(changed.value)
            cur.execute("ROLLBACK TO SAVEPOINT changed_evaluation")
            cur.execute(
                "SELECT intent->>'evaluation_digest', intent_digest FROM public.finance_order_intents WHERE id = %s",
                (other_intent,),
            )
            stored_evaluation, stored_digest = cur.fetchone()
            assert stored_digest == other_digest
            cur.execute(
                """
                SELECT evaluation_digest
                FROM public.finance_risk_evaluations
                WHERE book_id = %s
                ORDER BY created_at DESC, ctid DESC
                LIMIT 1
                """,
                (other_book,),
            )
            assert cur.fetchone()[0] != stored_evaluation
            cur.execute("SELECT count(*) FROM public.finance_paper_allocations")
            assert cur.fetchone()[0] == 0

            cur.execute("SAVEPOINT missing_intent")
            with pytest.raises(psycopg2.Error) as missing:
                cur.execute(
                    "SELECT public.finance_recheck_order_intent(%s)",
                    ("99999999-9999-9999-9999-999999999999",),
                )
            assert "order intent not found" in _error_text(missing.value)
            cur.execute("ROLLBACK TO SAVEPOINT missing_intent")

            cur.execute("SAVEPOINT viewer_recheck")
            as_user(member, USER_D)
            with pytest.raises(psycopg2.Error) as viewer_denied:
                cur.execute("SELECT public.finance_recheck_order_intent(%s)", (intent_id,))
            assert "not an organization writer" in _error_text(viewer_denied.value)
            cur.execute("ROLLBACK TO SAVEPOINT viewer_recheck")
            cur.execute("SAVEPOINT outsider_recheck")
            as_user(member, USER_C)
            with pytest.raises(psycopg2.Error) as outsider_denied:
                cur.execute("SELECT public.finance_recheck_order_intent(%s)", (intent_id,))
            assert "not an organization writer" in _error_text(outsider_denied.value)
            cur.execute("ROLLBACK TO SAVEPOINT outsider_recheck")
        member.commit()
    finally:
        member.close()

    outsider = psycopg2.connect(APP_DSN)
    outsider.autocommit = False
    try:
        as_user(outsider, USER_C)
        with outsider.cursor() as cur:
            cur.execute("SELECT count(*) FROM public.finance_order_intents")
            assert cur.fetchone()[0] == 0
        outsider.commit()
    finally:
        outsider.close()

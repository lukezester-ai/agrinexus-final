import json
import os
from datetime import datetime, timedelta, timezone

import psycopg2
import pytest

from engine.book import run_spec_book
from engine.fixture import fixture_closes
from engine.intent import canonical_order_intent, intent_digest
from engine.test_book import ALWAYS_LONG
from test_book_gate import _allow_evaluation
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


def _error_text(error: BaseException) -> str:
    return getattr(error, "pgerror", None) or str(error)


def test_order_intent_is_a_canonical_copy_of_an_approval():
    book = run_spec_book(fixture_closes(), ALWAYS_LONG)
    with psycopg2.connect(SUPER_DSN) as admin, admin.cursor() as cur:
        cur.execute(
            """
            SELECT count(*)
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname ~* 'broker|execution_gateway|live_order'
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
                'finance_create_order_intent',
                'finance_approve_strategy_result',
                'finance_compile_strategy_candidate'
              )
            """
        )
        sources = dict(cur.fetchall())
        intent_source = sources["finance_create_order_intent"]
        for name in (
            "finance_evaluate_risk_policy",
            "finance_apply_paper_book",
            "finance_paper_allocations",
            "finance_approve_strategy_result",
        ):
            assert name not in intent_source
        assert "finance_create_order_intent" not in sources["finance_approve_strategy_result"]
        assert "finance_create_order_intent" not in sources["finance_compile_strategy_candidate"]
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
            _allow_evaluation(cur, book_id)
            cur.execute("SELECT public.finance_approve_strategy_result(%s)", (book_id,))
            approval_id = str(cur.fetchone()[0])
            cur.execute("SELECT count(*) FROM public.finance_order_intents")
            assert cur.fetchone()[0] == 0
            cur.execute("SELECT count(*) FROM public.finance_paper_allocations")
            assert cur.fetchone()[0] == 0

            for payload in (
                None,
                [],
                {"quantity": "9.000000"},
                {"price": "1"},
                {"venue": "NYSE"},
                {"broker": "desk"},
                {"side": "long"},
                {"instrument": "BETA"},
                {"organization_id": ORG_A},
            ):
                cur.execute("SAVEPOINT rejected_intent")
                with pytest.raises(psycopg2.Error) as rejected:
                    cur.execute(
                        "SELECT public.finance_create_order_intent(%s, %s::jsonb)",
                        (approval_id, json.dumps(payload)),
                    )
                assert "order intent is invalid" in _error_text(rejected.value)
                cur.execute("ROLLBACK TO SAVEPOINT rejected_intent")
            cur.execute("SELECT count(*) FROM public.finance_order_intents")
            assert cur.fetchone()[0] == 0

            cur.execute("SAVEPOINT missing_approval")
            with pytest.raises(psycopg2.Error) as missing:
                cur.execute(
                    "SELECT public.finance_create_order_intent(%s, %s::jsonb)",
                    ("99999999-9999-9999-9999-999999999999", "{}"),
                )
            assert "order approval not found" in _error_text(missing.value)
            cur.execute("ROLLBACK TO SAVEPOINT missing_approval")

            cur.execute(
                """
                SELECT specification_digest, strategy_digest, backtest_digest, risk_digest, evaluation_digest
                FROM public.finance_strategy_approvals
                WHERE id = %s
                """,
                (approval_id,),
            )
            digests = cur.fetchone()
            expected = canonical_order_intent(
                approval_id,
                "ACME",
                book.allocation.quantity,
                *digests,
            )
            expected_digest = intent_digest(expected)
            cur.execute(
                "SELECT public.finance_create_order_intent(%s, %s::jsonb)",
                (approval_id, "{}"),
            )
            first_id = cur.fetchone()[0]
            cur.execute(
                "SELECT public.finance_create_order_intent(%s, %s::jsonb)",
                (approval_id, "{}"),
            )
            second_id = cur.fetchone()[0]
            cur.execute(
                """
                SELECT organization_id, approval_id::text, book_id, intent, intent_digest, created_by
                FROM public.finance_order_intents
                WHERE id IN (%s, %s)
                ORDER BY created_at, id
                """,
                (first_id, second_id),
            )
            rows = cur.fetchall()
            assert rows[0][0] == ORG_A
            assert rows[0][1] == approval_id
            assert rows[0][2] == book_id
            assert rows[0][3] == expected
            assert rows[0][4] == rows[1][4] == expected_digest
            assert rows[0][5] == USER_B
            cur.execute(
                """
                SELECT actor_user_id, details->>'intent_digest'
                FROM public.finance_audit_log
                WHERE action = 'order_intent.created' AND subject_id = %s
                """,
                (first_id,),
            )
            assert cur.fetchone() == (USER_B, expected_digest)
            cur.execute("SELECT count(*) FROM public.finance_paper_allocations")
            assert cur.fetchone()[0] == 0

            cur.execute(
                "SELECT public.finance_create_strategy(%s, %s, %s::jsonb)",
                (instrument_id, "Hold", json.dumps(ALWAYS_LONG)),
            )
            other_strategy = cur.fetchone()[0]
            cur.execute("SELECT public.finance_validate_strategy(%s)", (other_strategy,))
            cur.fetchone()
            cur.execute("SELECT public.finance_execute_strategy(%s)", (other_strategy,))
            cur.fetchone()
            cur.execute("SELECT public.finance_run_spec_backtest(%s)", (other_strategy,))
            other_book = cur.fetchone()[0]
            _allow_evaluation(cur, other_book)
            cur.execute("SELECT public.finance_approve_strategy_result(%s)", (other_book,))
            other_approval = str(cur.fetchone()[0])
            cur.execute(
                "SELECT public.finance_create_order_intent(%s, %s::jsonb)",
                (other_approval, "{}"),
            )
            cur.fetchone()
            cur.execute(
                """
                SELECT intent_digest
                FROM public.finance_order_intents
                WHERE approval_id = %s
                """,
                (other_approval,),
            )
            assert cur.fetchone()[0] != expected_digest

            cur.execute("SAVEPOINT direct_update")
            with pytest.raises(psycopg2.Error):
                cur.execute(
                    "UPDATE public.finance_order_intents SET intent_digest = %s WHERE id = %s",
                    ("0" * 32, first_id),
                )
            cur.execute("ROLLBACK TO SAVEPOINT direct_update")

            cur.execute("SAVEPOINT viewer_intent")
            as_user(member, USER_D)
            with pytest.raises(psycopg2.Error) as viewer_denied:
                cur.execute(
                    "SELECT public.finance_create_order_intent(%s, %s::jsonb)",
                    (approval_id, "{}"),
                )
            assert "not an organization writer" in _error_text(viewer_denied.value)
            cur.execute("ROLLBACK TO SAVEPOINT viewer_intent")
            cur.execute("SAVEPOINT outsider_intent")
            as_user(member, USER_C)
            with pytest.raises(psycopg2.Error) as outsider_denied:
                cur.execute(
                    "SELECT public.finance_create_order_intent(%s, %s::jsonb)",
                    (approval_id, "{}"),
                )
            assert "not an organization writer" in _error_text(outsider_denied.value)
            cur.execute("ROLLBACK TO SAVEPOINT outsider_intent")
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

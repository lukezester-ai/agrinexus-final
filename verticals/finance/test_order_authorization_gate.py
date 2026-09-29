import json
import os

import psycopg2
import pytest

from engine.authorization import authorization_digest, canonical_order_authorization
from test_integration_gate import ORG_A, ORG_B, USER_A, USER_B, USER_C, USER_D, as_user
from test_order_intent_recheck_gate import _bars, _policy, _prepare

SUPER_DSN = os.environ.get("DB_URL_SUPERUSER")
APP_DSN = os.environ.get("DB_URL_APPUSER")

pytestmark = pytest.mark.skipif(
    not SUPER_DSN or not APP_DSN,
    reason="DB_URL_SUPERUSER and DB_URL_APPUSER are required",
)


def _error_text(error: BaseException) -> str:
    return getattr(error, "pgerror", None) or str(error)


def test_authorization_binds_a_rechecked_intent_and_does_not_send():
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
                'finance_authorize_order_intent',
                'finance_match_order_authorization',
                'finance_compile_strategy_candidate',
                'finance_approve_strategy_result'
              )
            """
        )
        sources = dict(cur.fetchall())
        for source in (
            sources["finance_authorize_order_intent"],
            sources["finance_match_order_authorization"],
        ):
            assert "finance_recheck_order_intent" in source
            for name in (
                "finance_evaluate_risk_policy",
                "finance_apply_paper_book",
                "finance_paper_allocations",
                "peak",
            ):
                assert name not in source
        assert "finance_authorize_order_intent" not in sources["finance_compile_strategy_candidate"]
        assert "finance_authorize_order_intent" not in sources["finance_approve_strategy_result"]
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
            cur.execute(
                "SELECT intent->>'evaluation_digest' FROM public.finance_order_intents WHERE id = %s",
                (intent_id,),
            )
            evaluation_digest = cur.fetchone()[0]
            cur.execute(
                "SELECT public.finance_replace_risk_policy(%s, %s::jsonb)",
                (policy_id, json.dumps(_policy("Open", max_drawdown=0.5))),
            )
            cur.fetchone()
            cur.execute("SAVEPOINT blocked_recheck")
            with pytest.raises(psycopg2.Error) as blocked:
                cur.execute(
                    "SELECT public.finance_authorize_order_intent(%s, %s::jsonb)",
                    (intent_id, "{}"),
                )
            assert "order intent does not match" in _error_text(blocked.value)
            cur.execute("ROLLBACK TO SAVEPOINT blocked_recheck")
            cur.execute("SELECT count(*) FROM public.finance_order_authorizations")
            assert cur.fetchone()[0] == 0
            cur.execute(
                "SELECT public.finance_replace_risk_policy(%s, %s::jsonb)",
                (policy_id, json.dumps(_policy("Open"))),
            )
            cur.fetchone()

            for payload in (None, [], {"intent_digest": intent_digest}, {"broker": "desk"}, {"note": "send"}):
                cur.execute("SAVEPOINT rejected_authorization")
                with pytest.raises(psycopg2.Error) as rejected:
                    cur.execute(
                        "SELECT public.finance_authorize_order_intent(%s, %s::jsonb)",
                        (intent_id, json.dumps(payload)),
                    )
                assert "order authorization is invalid" in _error_text(rejected.value)
                cur.execute("ROLLBACK TO SAVEPOINT rejected_authorization")

            expected = canonical_order_authorization(str(intent_id), intent_digest, evaluation_digest)
            expected_digest = authorization_digest(expected)
            cur.execute(
                "SELECT public.finance_authorize_order_intent(%s, %s::jsonb)",
                (intent_id, "{}"),
            )
            first_id = cur.fetchone()[0]
            cur.execute(
                "SELECT public.finance_authorize_order_intent(%s, %s::jsonb)",
                (intent_id, "{}"),
            )
            second_id = cur.fetchone()[0]
            cur.execute(
                """
                SELECT organization_id, intent_id::text, intent_digest, evaluation_digest,
                       authorization_digest, authorized_by
                FROM public.finance_order_authorizations
                WHERE id IN (%s, %s)
                """,
                (first_id, second_id),
            )
            rows = cur.fetchall()
            assert rows[0] == rows[1] == (ORG_A, str(intent_id), intent_digest, evaluation_digest, expected_digest, USER_B)
            cur.execute(
                """
                SELECT count(*)
                FROM public.finance_audit_log
                WHERE action = 'strategy.approved' AND subject_id IN (%s, %s)
                """,
                (first_id, second_id),
            )
            assert cur.fetchone()[0] == 0
            cur.execute(
                """
                SELECT actor_user_id, details->>'authorization_digest', details->>'intent_digest',
                       details->>'evaluation_digest'
                FROM public.finance_audit_log
                WHERE action = 'order_intent.authorized' AND subject_id = %s
                """,
                (first_id,),
            )
            assert cur.fetchone() == (USER_B, expected_digest, intent_digest, evaluation_digest)
            cur.execute("SELECT public.finance_match_order_authorization(%s)", (first_id,))
            assert cur.fetchone()[0] == first_id
            cur.execute("SELECT count(*) FROM public.finance_paper_allocations")
            assert cur.fetchone()[0] == 0

            cur.execute("SAVEPOINT direct_update")
            with pytest.raises(psycopg2.Error):
                cur.execute(
                    "UPDATE public.finance_order_authorizations SET intent_digest = %s WHERE id = %s",
                    ("0" * 32, first_id),
                )
            cur.execute("ROLLBACK TO SAVEPOINT direct_update")

            cur.execute("SAVEPOINT viewer_authorize")
            as_user(member, USER_D)
            with pytest.raises(psycopg2.Error) as viewer_denied:
                cur.execute(
                    "SELECT public.finance_authorize_order_intent(%s, %s::jsonb)",
                    (intent_id, "{}"),
                )
            assert "not an organization writer" in _error_text(viewer_denied.value)
            cur.execute("ROLLBACK TO SAVEPOINT viewer_authorize")
            cur.execute("SAVEPOINT outsider_authorize")
            as_user(member, USER_C)
            with pytest.raises(psycopg2.Error) as outsider_denied:
                cur.execute(
                    "SELECT public.finance_authorize_order_intent(%s, %s::jsonb)",
                    (intent_id, "{}"),
                )
            assert "not an organization writer" in _error_text(outsider_denied.value)
            cur.execute("ROLLBACK TO SAVEPOINT outsider_authorize")
        member.commit()
    finally:
        member.close()

    with psycopg2.connect(SUPER_DSN) as admin, admin.cursor() as cur:
        cur.execute(
            "UPDATE public.finance_order_intents SET intent_digest = %s WHERE id = %s",
            ("f" * 32, intent_id),
        )
        admin.commit()

    checker = psycopg2.connect(APP_DSN)
    checker.autocommit = False
    try:
        as_user(checker, USER_B)
        with checker.cursor() as cur:
            cur.execute("SAVEPOINT stale_intent")
            with pytest.raises(psycopg2.Error) as stale:
                cur.execute("SELECT public.finance_match_order_authorization(%s)", (first_id,))
            assert "order authorization does not match" in _error_text(stale.value)
            cur.execute("ROLLBACK TO SAVEPOINT stale_intent")
            cur.execute(
                "SELECT intent_digest, authorization_digest FROM public.finance_order_authorizations WHERE id = %s",
                (first_id,),
            )
            assert cur.fetchone() == (intent_digest, expected_digest)
        checker.commit()
    finally:
        checker.close()

    with psycopg2.connect(SUPER_DSN) as admin, admin.cursor() as cur:
        cur.execute(
            "UPDATE public.finance_order_intents SET intent_digest = %s WHERE id = %s",
            (intent_digest, intent_id),
        )
        admin.commit()

    restored = psycopg2.connect(APP_DSN)
    restored.autocommit = False
    try:
        as_user(restored, USER_B)
        with restored.cursor() as cur:
            cur.execute("SELECT public.finance_match_order_authorization(%s)", (first_id,))
            assert cur.fetchone()[0] == first_id
        restored.commit()
    finally:
        restored.close()

    outsider = psycopg2.connect(APP_DSN)
    outsider.autocommit = False
    try:
        as_user(outsider, USER_C)
        with outsider.cursor() as cur:
            cur.execute("SELECT count(*) FROM public.finance_order_authorizations")
            assert cur.fetchone()[0] == 0
        outsider.commit()
    finally:
        outsider.close()

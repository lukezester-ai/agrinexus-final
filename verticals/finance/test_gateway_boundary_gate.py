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

BLOCKED_CALLERS = (
    "finance_compile_strategy_candidate",
    "finance_run_compiled_strategy",
    "finance_apply_paper_book",
    "finance_approve_strategy_result",
    "finance_evaluate_risk_policy",
    "finance_create_risk_policy",
    "finance_replace_risk_policy",
    "finance_create_order_intent",
    "finance_recheck_order_intent",
    "finance_authorize_order_intent",
    "finance_match_order_authorization",
)


def _error_text(error: BaseException) -> str:
    return getattr(error, "pgerror", None) or str(error)


def _counts(cur) -> tuple:
    cur.execute(
        """
        SELECT
            (SELECT count(*) FROM public.finance_order_intents),
            (SELECT count(*) FROM public.finance_order_authorizations),
            (SELECT count(*) FROM public.finance_risk_evaluations),
            (SELECT count(*) FROM public.finance_paper_allocations)
        """
    )
    return cur.fetchone()


def test_gateway_admits_one_authorization_and_does_not_send():
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
            SELECT count(*)
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name ~* 'broker|execution_gateway|live_order'
            """
        )
        assert cur.fetchone()[0] == 0
        cur.execute(
            """
            SELECT p.proname
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.prosrc LIKE '%finance_match_order_authorization%'
              AND p.proname <> 'finance_match_order_authorization'
            """
        )
        assert cur.fetchall() == [("finance_gateway_boundary",)]
        cur.execute(
            """
            SELECT p.proname, p.prosrc
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname = ANY(%s)
            """,
            (["finance_gateway_boundary", *BLOCKED_CALLERS],),
        )
        sources = dict(cur.fetchall())
        gateway_source = sources["finance_gateway_boundary"]
        assert "finance_match_order_authorization" in gateway_source
        assert "finance_canonical_json" in gateway_source
        for name in (
            "finance_apply_paper_book",
            "finance_paper_allocations",
            "finance_create_order_intent",
            "finance_evaluate_risk_policy",
            "finance_authorize_order_intent",
            "finance_create_risk_policy",
            "metrics_from_equity",
            "peak",
            "broker",
            "live_order",
            "execution_gateway",
        ):
            assert name not in gateway_source
        for name in BLOCKED_CALLERS:
            assert "finance_gateway_boundary" not in sources[name]
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
            cur.execute("SAVEPOINT missing_authorization")
            with pytest.raises(psycopg2.Error) as missing:
                cur.execute(
                    "SELECT public.finance_gateway_boundary(%s, %s::jsonb)",
                    (intent_id, "{}"),
                )
            assert "order authorization not found" in _error_text(missing.value)
            cur.execute("ROLLBACK TO SAVEPOINT missing_authorization")

            cur.execute(
                "SELECT public.finance_authorize_order_intent(%s, %s::jsonb)",
                (intent_id, "{}"),
            )
            authorization_id = cur.fetchone()[0]
            expected_digest = authorization_digest(
                canonical_order_authorization(str(intent_id), intent_digest, evaluation_digest)
            )
            cur.execute("SAVEPOINT intent_is_not_authorization")
            with pytest.raises(psycopg2.Error) as intent_only:
                cur.execute(
                    "SELECT public.finance_gateway_boundary(%s, %s::jsonb)",
                    (intent_id, "{}"),
                )
            assert "order authorization not found" in _error_text(intent_only.value)
            cur.execute("ROLLBACK TO SAVEPOINT intent_is_not_authorization")

            for payload in (
                None,
                [],
                {"authorization_digest": expected_digest},
                {"broker": "desk"},
                {"price": "1"},
                {"venue": "NYSE"},
                {"order": {}},
                {"note": "send"},
            ):
                cur.execute("SAVEPOINT rejected_gateway")
                with pytest.raises(psycopg2.Error) as rejected:
                    cur.execute(
                        "SELECT public.finance_gateway_boundary(%s, %s::jsonb)",
                        (authorization_id, json.dumps(payload)),
                    )
                assert "gateway boundary is invalid" in _error_text(rejected.value)
                cur.execute("ROLLBACK TO SAVEPOINT rejected_gateway")

            cur.execute(
                "SELECT public.finance_replace_risk_policy(%s, %s::jsonb)",
                (policy_id, json.dumps(_policy("Open", max_drawdown=0.5))),
            )
            cur.fetchone()
            cur.execute("SAVEPOINT stale_policy")
            with pytest.raises(psycopg2.Error) as stale_policy:
                cur.execute(
                    "SELECT public.finance_gateway_boundary(%s, %s::jsonb)",
                    (authorization_id, "{}"),
                )
            assert "order intent does not match" in _error_text(stale_policy.value)
            cur.execute("ROLLBACK TO SAVEPOINT stale_policy")
            cur.execute(
                "SELECT public.finance_replace_risk_policy(%s, %s::jsonb)",
                (policy_id, json.dumps(_policy("Open"))),
            )
            cur.fetchone()
            before = _counts(cur)

            cur.execute(
                "SELECT public.finance_gateway_boundary(%s, %s::jsonb)",
                (authorization_id, "{}"),
            )
            assert cur.fetchone()[0] == authorization_id
            cur.execute(
                "SELECT public.finance_gateway_boundary(%s, %s::jsonb)",
                (authorization_id, "{}"),
            )
            assert cur.fetchone()[0] == authorization_id
            assert _counts(cur) == before
            cur.execute(
                """
                SELECT actor_user_id, details->>'authorization_digest', details->>'intent_digest',
                       details->>'evaluation_digest', count(*)
                FROM public.finance_audit_log
                WHERE action = 'gateway_boundary.admitted' AND subject_id = %s
                GROUP BY actor_user_id, details->>'authorization_digest', details->>'intent_digest',
                         details->>'evaluation_digest'
                """,
                (authorization_id,),
            )
            assert cur.fetchone() == (USER_B, expected_digest, intent_digest, evaluation_digest, 2)

            cur.execute("SAVEPOINT viewer_gateway")
            as_user(member, USER_D)
            with pytest.raises(psycopg2.Error) as viewer_denied:
                cur.execute(
                    "SELECT public.finance_gateway_boundary(%s, %s::jsonb)",
                    (authorization_id, "{}"),
                )
            assert "not an organization writer" in _error_text(viewer_denied.value)
            cur.execute("ROLLBACK TO SAVEPOINT viewer_gateway")
            cur.execute("SAVEPOINT outsider_gateway")
            as_user(member, USER_C)
            with pytest.raises(psycopg2.Error) as outsider_denied:
                cur.execute(
                    "SELECT public.finance_gateway_boundary(%s, %s::jsonb)",
                    (authorization_id, "{}"),
                )
            assert "not an organization writer" in _error_text(outsider_denied.value)
            cur.execute("ROLLBACK TO SAVEPOINT outsider_gateway")
        member.commit()
    finally:
        member.close()

    with psycopg2.connect(SUPER_DSN) as admin, admin.cursor() as cur:
        cur.execute("SET session_replication_role = replica")
        cur.execute(
            "UPDATE public.finance_order_authorizations SET authorization_digest = %s WHERE id = %s",
            ("0" * 32, authorization_id),
        )
        cur.execute("SET session_replication_role = origin")
        admin.commit()

    checker = psycopg2.connect(APP_DSN)
    checker.autocommit = False
    try:
        as_user(checker, USER_B)
        with checker.cursor() as cur:
            cur.execute("SAVEPOINT stale_authorization_digest")
            with pytest.raises(psycopg2.Error) as stale_authorization:
                cur.execute(
                    "SELECT public.finance_gateway_boundary(%s, %s::jsonb)",
                    (authorization_id, "{}"),
                )
            assert "order authorization does not match" in _error_text(stale_authorization.value)
            cur.execute("ROLLBACK TO SAVEPOINT stale_authorization_digest")
        checker.commit()
    finally:
        checker.close()

    with psycopg2.connect(SUPER_DSN) as admin, admin.cursor() as cur:
        cur.execute("SET session_replication_role = replica")
        cur.execute(
            "UPDATE public.finance_order_authorizations SET authorization_digest = %s WHERE id = %s",
            (expected_digest, authorization_id),
        )
        cur.execute("SET session_replication_role = origin")
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
            with pytest.raises(psycopg2.Error) as stale_intent:
                cur.execute(
                    "SELECT public.finance_gateway_boundary(%s, %s::jsonb)",
                    (authorization_id, "{}"),
                )
            assert "order authorization does not match" in _error_text(stale_intent.value)
            cur.execute("ROLLBACK TO SAVEPOINT stale_intent")
            cur.execute(
                "SELECT authorization_digest FROM public.finance_order_authorizations WHERE id = %s",
                (authorization_id,),
            )
            assert cur.fetchone()[0] == expected_digest
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
            cur.execute(
                "SELECT public.finance_gateway_boundary(%s, %s::jsonb)",
                (authorization_id, "{}"),
            )
            assert cur.fetchone()[0] == authorization_id
            cur.execute("SELECT count(*) FROM public.finance_paper_allocations")
            assert cur.fetchone()[0] == 0
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

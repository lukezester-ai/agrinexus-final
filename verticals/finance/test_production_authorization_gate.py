import json
import os

import psycopg2
import pytest

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
    "finance_gateway_boundary",
    "finance_create_execution_contract",
    "finance_sandbox_protocol",
    "finance_begin_sandbox_dispatch",
    "finance_finish_sandbox_dispatch",
    "finance_reconcile_sandbox_execution",
    "finance_live_boundary",
    "finance_production_execution",
)


def _error_text(error: BaseException) -> str:
    return getattr(error, "pgerror", None) or str(error)


def _bind(cur, instrument_id, name):
    policy_id, intent_id, intent_digest = _prepare(cur, instrument_id, name)
    cur.execute(
        "SELECT public.finance_authorize_order_intent(%s, %s::jsonb)",
        (intent_id, "{}"),
    )
    authorization_id = cur.fetchone()[0]
    cur.execute(
        "SELECT public.finance_create_execution_contract(%s, %s::jsonb)",
        (authorization_id, "{}"),
    )
    contract_id = cur.fetchone()[0]
    cur.execute(
        """
        SELECT contracts.execution_identity, grants.authorization_digest, grants.evaluation_digest,
               intents.approval_id
        FROM public.finance_execution_contracts contracts
        JOIN public.finance_order_authorizations grants ON grants.id = contracts.authorization_id
        JOIN public.finance_order_intents intents ON intents.id = contracts.intent_id
        WHERE contracts.id = %s
        """,
        (contract_id,),
    )
    identity, authorization_digest, evaluation_digest, approval_id = cur.fetchone()
    return {
        "policy_id": policy_id,
        "intent_id": intent_id,
        "intent_digest": intent_digest,
        "authorization_id": authorization_id,
        "contract_id": contract_id,
        "identity": identity,
        "authorization_digest": authorization_digest,
        "evaluation_digest": evaluation_digest,
        "approval_id": approval_id,
    }


def _record(cur, contract_id):
    cur.execute(
        "SELECT public.finance_record_production_authorization(%s, '{}'::jsonb)",
        (contract_id,),
    )
    return cur.fetchone()[0]


def _match(cur, contract_id):
    cur.execute(
        "SELECT public.finance_match_production_authorization(%s)",
        (contract_id,),
    )
    return cur.fetchone()[0]


def _cancel(cur, contract_id):
    cur.execute(
        "SELECT public.finance_cancel_production_authorization(%s, '{}'::jsonb)",
        (contract_id,),
    )
    return cur.fetchone()[0]


def test_production_authorization_binds_one_identity_and_does_not_send():
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
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'finance_production_authorizations'
              AND column_name ~* 'broker|endpoint|api_key|secret|password|credential|live_permitted|sent'
            """
        )
        assert cur.fetchone()[0] == 0
        cur.execute(
            """
            SELECT p.proname, p.prosrc
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname = ANY(%s)
            """,
            (
                [
                    "finance_record_production_authorization",
                    "finance_match_production_authorization",
                    "finance_cancel_production_authorization",
                    *BLOCKED_CALLERS,
                ],
            ),
        )
        sources = dict(cur.fetchall())
        for name in (
            "finance_record_production_authorization",
            "finance_match_production_authorization",
            "finance_cancel_production_authorization",
        ):
            source = sources[name]
            for forbidden in (
                "finance_begin_sandbox_dispatch",
                "finance_production_execution",
                "finance_live_boundary",
                "finance_apply_paper_book",
                "finance_evaluate_risk_policy",
                "finance_approve_strategy_result",
                "finance_authorize_order_intent",
                "urllib",
                "http",
                "broker",
                "live_order",
                "execution_gateway",
                "api_key",
                "password",
                "secret",
                "credential",
                "live_permitted",
            ):
                assert forbidden not in source
        match_source = sources["finance_match_production_authorization"]
        assert "clock_timestamp()" in match_source
        assert "production authorization expired" in match_source
        assert "production authorization does not match" in match_source
        assert "production authorization cancelled" in match_source
        for name in BLOCKED_CALLERS:
            assert "finance_record_production_authorization" not in sources[name]
            assert "finance_match_production_authorization" not in sources[name]
            assert "finance_cancel_production_authorization" not in sources[name]
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
            bound = {name: _bind(cur, instrument_id, name) for name in ("Open", "Hold", "Flat", "Wait")}
            cur.execute("SELECT count(*) FROM public.finance_strategy_approvals")
            approval_count = cur.fetchone()[0]
            cur.execute("SELECT count(*) FROM public.finance_order_authorizations")
            order_authorization_count = cur.fetchone()[0]
            cur.execute("SAVEPOINT missing_contract")
            with pytest.raises(psycopg2.Error) as missing:
                _record(cur, "99999999-9999-9999-9999-999999999999")
            assert "execution contract not found" in _error_text(missing.value)
            cur.execute("ROLLBACK TO SAVEPOINT missing_contract")
            cur.execute("SAVEPOINT client_authorization")
            with pytest.raises(psycopg2.Error) as client_authorization:
                cur.execute(
                    "SELECT public.finance_record_production_authorization(%s, %s::jsonb)",
                    (bound["Open"]["contract_id"], json.dumps({"live_permitted": True})),
                )
            assert "production authorization is invalid" in _error_text(client_authorization.value)
            cur.execute("ROLLBACK TO SAVEPOINT client_authorization")
            open_id = _record(cur, bound["Open"]["contract_id"])
            assert _record(cur, bound["Open"]["contract_id"]) == open_id
            assert _match(cur, bound["Open"]["contract_id"]) == open_id
            cur.execute(
                """
                SELECT organization_id, contract_id::text, order_authorization_id::text, intent_id::text,
                       execution_identity, intent_digest, evaluation_digest, authorization_digest,
                       production_authorization_digest, authorized_by, lifecycle, reason,
                       expires_at = authorized_at + interval '15 minutes'
                FROM public.finance_production_authorizations
                WHERE id = %s
                """,
                (open_id,),
            )
            row = cur.fetchone()
            assert row[0] == ORG_A
            assert row[1] == str(bound["Open"]["contract_id"])
            assert row[2] == str(bound["Open"]["authorization_id"])
            assert row[3] == str(bound["Open"]["intent_id"])
            assert row[4] == bound["Open"]["identity"]
            assert row[5] == bound["Open"]["intent_digest"]
            assert row[6] == bound["Open"]["evaluation_digest"]
            assert row[7] == bound["Open"]["authorization_digest"]
            assert row[8] != bound["Open"]["authorization_digest"]
            assert row[9] == USER_B
            assert row[10] == "recorded"
            assert row[11] is None
            assert row[12] is True
            assert open_id != bound["Open"]["authorization_id"]
            assert open_id != bound["Open"]["approval_id"]
            cur.execute("SELECT count(*) FROM public.finance_strategy_approvals")
            assert cur.fetchone()[0] == approval_count
            cur.execute("SELECT count(*) FROM public.finance_order_authorizations")
            assert cur.fetchone()[0] == order_authorization_count
            cur.execute(
                "SELECT public.finance_replace_risk_policy(%s, %s::jsonb)",
                (bound["Open"]["policy_id"], json.dumps(_policy("Open", max_drawdown=0.5))),
            )
            cur.fetchone()
            cur.execute("SAVEPOINT stale_policy")
            with pytest.raises(psycopg2.Error) as stale_policy:
                _match(cur, bound["Open"]["contract_id"])
            assert "production authorization does not match" in _error_text(stale_policy.value)
            cur.execute("ROLLBACK TO SAVEPOINT stale_policy")
            cur.execute(
                "SELECT policy_digest, production_authorization_digest FROM public.finance_production_authorizations WHERE id = %s",
                (open_id,),
            )
            stored_policy, stored_digest = cur.fetchone()
            cur.execute(
                "SELECT public.finance_replace_risk_policy(%s, %s::jsonb)",
                (bound["Open"]["policy_id"], json.dumps(_policy("Open"))),
            )
            cur.fetchone()
            assert _match(cur, bound["Open"]["contract_id"]) == open_id
            cur.execute(
                "SELECT policy_digest, production_authorization_digest, lifecycle FROM public.finance_production_authorizations WHERE id = %s",
                (open_id,),
            )
            assert cur.fetchone() == (stored_policy, stored_digest, "recorded")
            assert _cancel(cur, bound["Open"]["contract_id"]) == open_id
            assert _cancel(cur, bound["Open"]["contract_id"]) == open_id
            cur.execute("SAVEPOINT cancelled_match")
            with pytest.raises(psycopg2.Error) as cancelled_match:
                _match(cur, bound["Open"]["contract_id"])
            assert "production authorization cancelled" in _error_text(cancelled_match.value)
            cur.execute("ROLLBACK TO SAVEPOINT cancelled_match")
            cur.execute("SAVEPOINT cancelled_rerecord")
            with pytest.raises(psycopg2.Error) as cancelled_rerecord:
                _record(cur, bound["Open"]["contract_id"])
            assert "production authorization cancelled" in _error_text(cancelled_rerecord.value)
            cur.execute("ROLLBACK TO SAVEPOINT cancelled_rerecord")

            hold_id = _record(cur, bound["Hold"]["contract_id"])
            cur.execute(
                "SELECT public.finance_replace_risk_policy(%s, %s::jsonb)",
                (bound["Hold"]["policy_id"], json.dumps(_policy("Hold", max_drawdown=0.5))),
            )
            cur.fetchone()
            cur.execute(
                "SELECT book_id FROM public.finance_order_intents WHERE id = %s",
                (bound["Hold"]["intent_id"],),
            )
            hold_book = cur.fetchone()[0]
            cur.execute(
                "SELECT public.finance_evaluate_risk_policy(%s, %s)",
                (bound["Hold"]["policy_id"], hold_book),
            )
            cur.fetchone()
            cur.execute("SAVEPOINT changed_evaluation")
            with pytest.raises(psycopg2.Error) as changed_evaluation:
                _match(cur, bound["Hold"]["contract_id"])
            assert "production authorization does not match" in _error_text(changed_evaluation.value)
            cur.execute("ROLLBACK TO SAVEPOINT changed_evaluation")
            cur.execute(
                "SELECT evaluation_digest FROM public.finance_production_authorizations WHERE id = %s",
                (hold_id,),
            )
            assert cur.fetchone()[0] == bound["Hold"]["evaluation_digest"]
            cur.execute(
                """
                SELECT evaluation_digest
                FROM public.finance_risk_evaluations
                WHERE book_id = %s
                ORDER BY created_at DESC, ctid DESC
                LIMIT 1
                """,
                (hold_book,),
            )
            assert cur.fetchone()[0] != bound["Hold"]["evaluation_digest"]

            cur.execute(
                "SELECT public.finance_replace_risk_policy(%s, %s::jsonb)",
                (bound["Flat"]["policy_id"], json.dumps(_policy("Flat", max_drawdown=0.5))),
            )
            cur.fetchone()
            cur.execute("SAVEPOINT stale_record")
            with pytest.raises(psycopg2.Error) as stale_record:
                _record(cur, bound["Flat"]["contract_id"])
            assert "order intent does not match" in _error_text(stale_record.value)
            cur.execute("ROLLBACK TO SAVEPOINT stale_record")

            wait_id = _record(cur, bound["Wait"]["contract_id"])
            assert _match(cur, bound["Wait"]["contract_id"]) == wait_id
            cur.execute("SELECT count(*) FROM public.finance_production_authorizations")
            assert cur.fetchone()[0] == 3
            cur.execute("SELECT count(*) FROM public.finance_live_boundaries")
            assert cur.fetchone()[0] == 0
            cur.execute("SELECT count(*) FROM public.finance_production_refusals")
            assert cur.fetchone()[0] == 0
            cur.execute("SELECT count(*) FROM public.finance_sandbox_dispatches")
            assert cur.fetchone()[0] == 0
            cur.execute("SELECT count(*) FROM public.finance_paper_allocations")
            assert cur.fetchone()[0] == 0
            cur.execute(
                """
                SELECT count(*)
                FROM public.finance_audit_log
                WHERE action = 'production_authorization.recorded' AND subject_id = %s
                """,
                (open_id,),
            )
            assert cur.fetchone()[0] == 1
            cur.execute(
                """
                SELECT count(*)
                FROM public.finance_audit_log
                WHERE action = 'production_authorization.cancelled' AND subject_id = %s
                """,
                (open_id,),
            )
            assert cur.fetchone()[0] == 1
            cur.execute("SAVEPOINT direct_insert")
            with pytest.raises(psycopg2.Error):
                cur.execute(
                    "INSERT INTO public.finance_production_authorizations (organization_id) VALUES (%s)",
                    (ORG_A,),
                )
            cur.execute("ROLLBACK TO SAVEPOINT direct_insert")
            cur.execute("SAVEPOINT viewer_authorization")
            as_user(member, USER_D)
            with pytest.raises(psycopg2.Error) as viewer_denied:
                _record(cur, bound["Wait"]["contract_id"])
            assert "not an organization writer" in _error_text(viewer_denied.value)
            cur.execute("ROLLBACK TO SAVEPOINT viewer_authorization")
            as_user(member, USER_B)
        member.commit()
    finally:
        member.close()

    with psycopg2.connect(SUPER_DSN) as admin, admin.cursor() as cur:
        cur.execute("SAVEPOINT immutable_digest")
        with pytest.raises(psycopg2.Error) as immutable:
            cur.execute(
                """
                UPDATE public.finance_production_authorizations
                SET policy_digest = 'ffff'
                WHERE id = %s
                """,
                (wait_id,),
            )
        assert "production authorization is immutable" in _error_text(immutable.value)
        cur.execute("ROLLBACK TO SAVEPOINT immutable_digest")
        admin.commit()

    outsider = psycopg2.connect(APP_DSN)
    outsider.autocommit = False
    try:
        as_user(outsider, USER_C)
        with outsider.cursor() as cur:
            cur.execute("SELECT count(*) FROM public.finance_production_authorizations")
            assert cur.fetchone()[0] == 0
            with pytest.raises(psycopg2.Error) as outsider_denied:
                _match(cur, bound["Wait"]["contract_id"])
            assert "not an organization writer" in _error_text(outsider_denied.value)
        outsider.rollback()
    finally:
        outsider.close()

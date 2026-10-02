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
    "finance_record_production_authorization",
    "finance_match_production_authorization",
    "finance_cancel_production_authorization",
    "finance_pass_production_safety",
    "finance_engage_production_kill_switch",
)


def _error_text(error: BaseException) -> str:
    return getattr(error, "pgerror", None) or str(error)


def _hold(cur, instrument_id, name):
    policy_id, intent_id, _intent_digest = _prepare(cur, instrument_id, name)
    cur.execute("SELECT public.finance_authorize_order_intent(%s, '{}'::jsonb)", (intent_id,))
    authorization_id = cur.fetchone()[0]
    cur.execute(
        "SELECT public.finance_create_execution_contract(%s, '{}'::jsonb)",
        (authorization_id,),
    )
    contract_id = cur.fetchone()[0]
    cur.execute(
        "SELECT public.finance_record_production_authorization(%s, '{}'::jsonb)",
        (contract_id,),
    )
    cur.fetchone()
    cur.execute(
        "SELECT public.finance_pass_production_safety(%s, '{}'::jsonb)",
        (contract_id,),
    )
    cur.fetchone()
    return policy_id, contract_id


def _dispatch(cur, contract_id):
    cur.execute(
        "SELECT public.finance_record_production_dispatch(%s, '{}'::jsonb)",
        (contract_id,),
    )
    return cur.fetchone()[0]


def _result(cur, contract_id):
    cur.execute(
        "SELECT public.finance_record_production_external_result(%s, '{}'::jsonb)",
        (contract_id,),
    )
    return cur.fetchone()[0]


def _reconcile(cur, contract_id):
    cur.execute(
        "SELECT public.finance_reconcile_production_result(%s, '{}'::jsonb)",
        (contract_id,),
    )
    return cur.fetchone()[0]


def test_unobserved_dispatch_is_one_record_and_does_not_send():
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
              AND table_name IN (
                  'finance_production_dispatches',
                  'finance_production_external_results',
                  'finance_production_result_reconciliations'
              )
              AND column_name ~* 'broker|endpoint|api_key|secret|password|credential'
            """
        )
        assert cur.fetchone()[0] == 0
        cur.execute("SELECT public.finance_classify_production_observation('timeout')")
        assert cur.fetchone()[0] == "unknown"
        cur.execute("SELECT public.finance_classify_production_observation('missing')")
        assert cur.fetchone()[0] == "unknown"
        cur.execute("SELECT public.finance_classify_production_observation('filled')")
        assert cur.fetchone()[0] == "filled"
        cur.execute("SELECT public.finance_production_result_is_success('unknown')")
        assert cur.fetchone()[0] is False
        cur.execute("SELECT public.finance_production_result_is_success('accepted')")
        assert cur.fetchone()[0] is False
        cur.execute("SELECT public.finance_production_result_is_success('partial')")
        assert cur.fetchone()[0] is False
        cur.execute("SELECT public.finance_production_result_is_success('rejected')")
        assert cur.fetchone()[0] is False
        cur.execute("SELECT public.finance_production_result_is_success('unobserved')")
        assert cur.fetchone()[0] is False
        cur.execute("SELECT public.finance_production_result_is_success('filled')")
        assert cur.fetchone()[0] is True
        cur.execute("SELECT public.finance_production_outcome_class('rejected')")
        assert cur.fetchone()[0] == "rejected"
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
                    "finance_record_production_dispatch",
                    "finance_record_production_external_result",
                    "finance_reconcile_production_result",
                    *BLOCKED_CALLERS,
                ],
            ),
        )
        sources = dict(cur.fetchall())
        for name in (
            "finance_record_production_dispatch",
            "finance_record_production_external_result",
            "finance_reconcile_production_result",
        ):
            source = sources[name]
            for forbidden in (
                "finance_live_boundary",
                "finance_production_execution",
                "finance_begin_sandbox_dispatch",
                "finance_apply_paper_book",
                "urllib",
                "http",
                "broker",
                "live_order",
                "execution_gateway",
                "api_key",
                "password",
                "secret",
                "credential",
            ):
                assert forbidden not in source
        assert "production kill switch is engaged" in sources["finance_record_production_dispatch"]
        for name in BLOCKED_CALLERS:
            assert "finance_record_production_dispatch" not in sources[name]
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
            _open_policy, open_contract = _hold(cur, instrument_id, "Open")
            cur.execute("SAVEPOINT missing_safety")
            with pytest.raises(psycopg2.Error) as missing_safety:
                _dispatch(cur, "99999999-9999-9999-9999-999999999999")
            assert "production authorization not found" in _error_text(missing_safety.value)
            cur.execute("ROLLBACK TO SAVEPOINT missing_safety")
            dispatch_id = _dispatch(cur, open_contract)
            assert _dispatch(cur, open_contract) == dispatch_id
            cur.execute("SAVEPOINT client_result")
            with pytest.raises(psycopg2.Error) as client_result:
                cur.execute(
                    "SELECT public.finance_record_production_external_result(%s, %s::jsonb)",
                    (open_contract, json.dumps({"external_result": "filled"})),
                )
            assert "production external result is invalid" in _error_text(client_result.value)
            cur.execute("ROLLBACK TO SAVEPOINT client_result")
            result_id = _result(cur, open_contract)
            assert _result(cur, open_contract) == result_id
            reconciliation_id = _reconcile(cur, open_contract)
            assert _reconcile(cur, open_contract) == reconciliation_id
            cur.execute(
                """
                SELECT dispatches.organization_id, dispatches.admitted, dispatches.sent,
                       dispatches.live_permitted, dispatches.instrument, dispatches.side,
                       dispatches.quantity, dispatches.authorization_digest,
                       contracts.contract->>'instrument', contracts.contract->>'side',
                       contracts.contract->>'quantity', grants.authorization_digest
                FROM public.finance_production_dispatches dispatches
                JOIN public.finance_execution_contracts contracts ON contracts.id = dispatches.contract_id
                JOIN public.finance_production_authorizations grants
                  ON grants.id = dispatches.production_authorization_id
                WHERE dispatches.id = %s
                """,
                (dispatch_id,),
            )
            row = cur.fetchone()
            assert row[0] == ORG_A
            assert row[1] is False
            assert row[2] is False
            assert row[3] is False
            assert row[4] == row[8]
            assert row[5] == row[9]
            assert row[6] == row[10]
            assert row[7] == row[11]
            cur.execute(
                """
                SELECT external_result, outcome_class, success
                FROM public.finance_production_external_results
                WHERE id = %s
                """,
                (result_id,),
            )
            assert cur.fetchone() == ("unobserved", "unknown", False)
            cur.execute(
                """
                SELECT comparison, outcome_class, success
                FROM public.finance_production_result_reconciliations
                WHERE id = %s
                """,
                (reconciliation_id,),
            )
            assert cur.fetchone() == ("unresolved", "unknown", False)
            cur.execute(
                "SELECT payload_digest FROM public.finance_production_dispatches WHERE id = %s",
                (dispatch_id,),
            )
            open_digest = cur.fetchone()[0]

            _hold_policy, hold_contract = _hold(cur, instrument_id, "Hold")
            wait_policy, wait_contract = _hold(cur, instrument_id, "Wait")
            wait_dispatch = _dispatch(cur, wait_contract)
            _result(cur, wait_contract)
            cur.execute(
                "SELECT payload_digest FROM public.finance_production_dispatches WHERE id = %s",
                (wait_dispatch,),
            )
            wait_digest = cur.fetchone()[0]
            cur.execute(
                "SELECT public.finance_replace_risk_policy(%s, %s::jsonb)",
                (wait_policy, json.dumps(_policy("Wait", max_drawdown=0.5))),
            )
            cur.fetchone()
            cur.execute("SAVEPOINT stale_result")
            with pytest.raises(psycopg2.Error) as stale_result:
                _reconcile(cur, wait_contract)
            assert "production authorization does not match" in _error_text(stale_result.value)
            cur.execute("ROLLBACK TO SAVEPOINT stale_result")
            cur.execute(
                "SELECT payload_digest FROM public.finance_production_dispatches WHERE id = %s",
                (wait_dispatch,),
            )
            assert cur.fetchone()[0] == wait_digest

            cur.execute(
                "SELECT public.finance_engage_production_kill_switch(%s, '{}'::jsonb)",
                (open_contract,),
            )
            switch_id = cur.fetchone()[0]
            cur.execute(
                "SELECT public.finance_engage_production_kill_switch(%s, '{}'::jsonb)",
                (open_contract,),
            )
            assert cur.fetchone()[0] == switch_id
            cur.execute("SAVEPOINT killed_dispatch")
            with pytest.raises(psycopg2.Error) as killed_dispatch:
                _dispatch(cur, hold_contract)
            assert "production kill switch is engaged" in _error_text(killed_dispatch.value)
            cur.execute("ROLLBACK TO SAVEPOINT killed_dispatch")
            cur.execute("SELECT count(*) FROM public.finance_production_dispatches")
            assert cur.fetchone()[0] == 2
            cur.execute("SELECT count(*) FROM public.finance_live_boundaries")
            assert cur.fetchone()[0] == 0
            cur.execute("SELECT count(*) FROM public.finance_sandbox_dispatches")
            assert cur.fetchone()[0] == 0
            cur.execute("SELECT count(*) FROM public.finance_paper_allocations")
            assert cur.fetchone()[0] == 0
            cur.execute(
                """
                SELECT count(*) FROM public.finance_audit_log
                WHERE action = 'production_dispatch.recorded' AND subject_id = %s
                """,
                (dispatch_id,),
            )
            assert cur.fetchone()[0] == 1
            cur.execute("SAVEPOINT viewer_dispatch")
            as_user(member, USER_D)
            with pytest.raises(psycopg2.Error) as viewer_denied:
                _dispatch(cur, hold_contract)
            assert "not an organization writer" in _error_text(viewer_denied.value)
            cur.execute("ROLLBACK TO SAVEPOINT viewer_dispatch")
            as_user(member, USER_B)
        member.commit()
    finally:
        member.close()

    with psycopg2.connect(SUPER_DSN) as admin, admin.cursor() as cur:
        cur.execute("SAVEPOINT immutable_dispatch")
        with pytest.raises(psycopg2.Error) as immutable:
            cur.execute(
                """
                UPDATE public.finance_production_dispatches
                SET sent = TRUE
                WHERE id = %s
                """,
                (dispatch_id,),
            )
        assert "production dispatch is immutable" in _error_text(immutable.value)
        cur.execute("ROLLBACK TO SAVEPOINT immutable_dispatch")
        cur.execute(
            """
            SELECT dispatches.payload_digest = md5(public.finance_canonical_json(jsonb_build_object(
                'authorization_digest', dispatches.authorization_digest,
                'contract_digest', dispatches.contract_digest,
                'execution_identity', dispatches.execution_identity,
                'instrument', dispatches.instrument,
                'quantity', dispatches.quantity,
                'side', dispatches.side
            )))
            FROM public.finance_production_dispatches dispatches
            WHERE dispatches.id = %s
            """,
            (dispatch_id,),
        )
        assert cur.fetchone()[0] is True
        cur.execute("SAVEPOINT immutable_result")
        with pytest.raises(psycopg2.Error) as immutable_result:
            cur.execute(
                """
                UPDATE public.finance_production_external_results
                SET external_result = 'filled'
                WHERE id = %s
                """,
                (result_id,),
            )
        assert "production external result is immutable" in _error_text(immutable_result.value)
        cur.execute("ROLLBACK TO SAVEPOINT immutable_result")
        admin.commit()

    outsider = psycopg2.connect(APP_DSN)
    outsider.autocommit = False
    try:
        as_user(outsider, USER_C)
        with outsider.cursor() as cur:
            cur.execute("SELECT count(*) FROM public.finance_production_dispatches")
            assert cur.fetchone()[0] == 0
            with pytest.raises(psycopg2.Error) as outsider_denied:
                _dispatch(cur, open_contract)
            assert "not an organization writer" in _error_text(outsider_denied.value)
        outsider.rollback()
    finally:
        outsider.close()

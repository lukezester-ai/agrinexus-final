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
    "finance_record_production_dispatch",
    "finance_record_production_external_result",
    "finance_reconcile_production_result",
)

OBSERVED_FUNCTIONS = (
    "finance_record_observed_production_result",
    "finance_reconcile_observed_production_result",
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


def _observe(cur, contract_id, observation):
    cur.execute(
        "SELECT public.finance_record_observed_production_result(%s, %s, '{}'::jsonb)",
        (contract_id, observation),
    )
    return cur.fetchone()[0]


def _reconcile(cur, contract_id):
    cur.execute(
        "SELECT public.finance_reconcile_observed_production_result(%s, '{}'::jsonb)",
        (contract_id,),
    )
    return cur.fetchone()[0]


def test_observed_result_is_one_record_and_does_not_send():
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
                  'finance_observed_production_results',
                  'finance_observed_result_reconciliations'
              )
              AND column_name ~* 'broker|endpoint|api_key|secret|password|credential'
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
            (list(OBSERVED_FUNCTIONS) + list(BLOCKED_CALLERS),),
        )
        sources = dict(cur.fetchall())
        for name in OBSERVED_FUNCTIONS:
            source = sources[name]
            for forbidden in (
                "finance_live_boundary",
                "finance_production_execution",
                "finance_begin_sandbox_dispatch",
                "finance_apply_paper_book",
                "finance_production_kill_switches",
                "finance_engage_production_kill_switch",
                "finance_pass_production_safety",
                "finance_record_production_external_result",
                "finance_record_production_dispatch",
                "urllib",
                "http",
                "broker",
                "live_order",
                "execution_gateway",
                "api_key",
                "password",
                "secret",
                "credential",
                "endpoint",
                "live_permitted = TRUE",
                "sent = TRUE",
            ):
                assert forbidden not in source
            assert "production result does not match" in source
        for name in BLOCKED_CALLERS:
            assert "finance_record_observed_production_result" not in sources[name]
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
            _timeout_policy, timeout_contract = _hold(cur, instrument_id, "Timeout")
            _rejected_policy, rejected_contract = _hold(cur, instrument_id, "Rejected")
            _accepted_policy, accepted_contract = _hold(cur, instrument_id, "Accepted")
            wait_policy, wait_contract = _hold(cur, instrument_id, "Wait")
            _late_policy, late_contract = _hold(cur, instrument_id, "Late")
            _hold_policy, hold_contract = _hold(cur, instrument_id, "Hold")

            cur.execute("SAVEPOINT missing_authorization")
            with pytest.raises(psycopg2.Error) as missing_authorization:
                _observe(cur, "99999999-9999-9999-9999-999999999999", "filled")
            assert "production authorization not found" in _error_text(missing_authorization.value)
            cur.execute("ROLLBACK TO SAVEPOINT missing_authorization")
            cur.execute("SAVEPOINT missing_dispatch")
            with pytest.raises(psycopg2.Error) as missing_dispatch:
                _observe(cur, hold_contract, "filled")
            assert "production dispatch not found" in _error_text(missing_dispatch.value)
            cur.execute("ROLLBACK TO SAVEPOINT missing_dispatch")

            open_dispatch = _dispatch(cur, open_contract)
            timeout_dispatch = _dispatch(cur, timeout_contract)
            rejected_dispatch = _dispatch(cur, rejected_contract)
            accepted_dispatch = _dispatch(cur, accepted_contract)
            wait_dispatch = _dispatch(cur, wait_contract)
            late_dispatch = _dispatch(cur, late_contract)
            cur.execute("SELECT count(*) FROM public.finance_production_dispatches")
            assert cur.fetchone()[0] == 6

            cur.execute("SAVEPOINT client_result")
            with pytest.raises(psycopg2.Error) as client_result:
                cur.execute(
                    "SELECT public.finance_record_observed_production_result(%s, 'filled', %s::jsonb)",
                    (open_contract, json.dumps({"sent": True})),
                )
            assert "production observed result is invalid" in _error_text(client_result.value)
            cur.execute("ROLLBACK TO SAVEPOINT client_result")
            for observation in ("broker", "unobserved"):
                cur.execute("SAVEPOINT bad_observation")
                with pytest.raises(psycopg2.Error) as bad_observation:
                    _observe(cur, open_contract, observation)
                assert "production observed result is invalid" in _error_text(bad_observation.value)
                cur.execute("ROLLBACK TO SAVEPOINT bad_observation")

            filled_id = _observe(cur, open_contract, "filled")
            assert _observe(cur, open_contract, "filled") == filled_id
            cur.execute("SAVEPOINT conflicting_result")
            with pytest.raises(psycopg2.Error) as conflicting_result:
                _observe(cur, open_contract, "unknown")
            assert "production result does not match" in _error_text(conflicting_result.value)
            cur.execute("ROLLBACK TO SAVEPOINT conflicting_result")
            cur.execute(
                "SELECT count(*) FROM public.finance_observed_production_results WHERE dispatch_id = %s",
                (open_dispatch,),
            )
            assert cur.fetchone()[0] == 1
            cur.execute(
                """
                SELECT external_result, outcome_class, success, admitted, sent, live_permitted,
                       instrument, side, quantity
                FROM public.finance_observed_production_results
                WHERE id = %s
                """,
                (filled_id,),
            )
            filled = cur.fetchone()
            assert filled[:6] == ("filled", "success", True, False, False, False)
            cur.execute(
                """
                SELECT contract->>'instrument', contract->>'side', contract->>'quantity'
                FROM public.finance_execution_contracts
                WHERE id = %s
                """,
                (open_contract,),
            )
            assert filled[6:] == cur.fetchone()
            filled_reconciliation = _reconcile(cur, open_contract)
            assert _reconcile(cur, open_contract) == filled_reconciliation
            cur.execute(
                """
                SELECT comparison, outcome_class, success, sent, live_permitted
                FROM public.finance_observed_result_reconciliations
                WHERE id = %s
                """,
                (filled_reconciliation,),
            )
            assert cur.fetchone() == ("matched", "success", True, False, False)

            timeout_id = _observe(cur, timeout_contract, "timeout")
            cur.execute(
                """
                SELECT external_result, outcome_class, success, sent, live_permitted
                FROM public.finance_observed_production_results
                WHERE id = %s
                """,
                (timeout_id,),
            )
            assert cur.fetchone() == ("unknown", "unknown", False, False, False)
            timeout_reconciliation = _reconcile(cur, timeout_contract)
            cur.execute(
                """
                SELECT comparison, outcome_class, success, sent, live_permitted
                FROM public.finance_observed_result_reconciliations
                WHERE id = %s
                """,
                (timeout_reconciliation,),
            )
            assert cur.fetchone() == ("unresolved", "unknown", False, False, False)

            rejected_id = _observe(cur, rejected_contract, "rejected")
            rejected_reconciliation = _reconcile(cur, rejected_contract)
            cur.execute(
                """
                SELECT external_result, outcome_class, success, sent, live_permitted
                FROM public.finance_observed_production_results
                WHERE id = %s
                """,
                (rejected_id,),
            )
            assert cur.fetchone() == ("rejected", "rejected", False, False, False)
            cur.execute(
                """
                SELECT comparison, outcome_class, success, sent, live_permitted
                FROM public.finance_observed_result_reconciliations
                WHERE id = %s
                """,
                (rejected_reconciliation,),
            )
            assert cur.fetchone() == ("terminal", "rejected", False, False, False)

            accepted_id = _observe(cur, accepted_contract, "accepted")
            cur.execute(
                """
                SELECT external_result, outcome_class, success, sent, live_permitted
                FROM public.finance_observed_production_results
                WHERE id = %s
                """,
                (accepted_id,),
            )
            assert cur.fetchone() == ("accepted", "unknown", False, False, False)

            wait_id = _observe(cur, wait_contract, "filled")
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
                """
                SELECT external_result, success, sent, live_permitted
                FROM public.finance_observed_production_results
                WHERE id = %s
                """,
                (wait_id,),
            )
            assert cur.fetchone() == ("filled", True, False, False)
            cur.execute(
                "SELECT count(*) FROM public.finance_observed_result_reconciliations WHERE dispatch_id = %s",
                (wait_dispatch,),
            )
            assert cur.fetchone()[0] == 0

            cur.execute(
                "SELECT public.finance_engage_production_kill_switch(%s, '{}'::jsonb)",
                (open_contract,),
            )
            cur.fetchone()
            late_id = _observe(cur, late_contract, "filled")
            cur.execute(
                """
                SELECT external_result, success, admitted, sent, live_permitted
                FROM public.finance_observed_production_results
                WHERE id = %s
                """,
                (late_id,),
            )
            assert cur.fetchone() == ("filled", True, False, False, False)
            cur.execute("SAVEPOINT killed_dispatch")
            with pytest.raises(psycopg2.Error) as killed_dispatch:
                _dispatch(cur, hold_contract)
            assert "production kill switch is engaged" in _error_text(killed_dispatch.value)
            cur.execute("ROLLBACK TO SAVEPOINT killed_dispatch")

            cur.execute("SELECT count(*) FROM public.finance_production_dispatches")
            assert cur.fetchone()[0] == 6
            cur.execute("SELECT count(*) FROM public.finance_observed_production_results")
            assert cur.fetchone()[0] == 6
            cur.execute("SELECT count(*) FROM public.finance_production_external_results")
            assert cur.fetchone()[0] == 0
            cur.execute("SELECT count(*) FROM public.finance_live_boundaries")
            assert cur.fetchone()[0] == 0
            cur.execute("SELECT count(*) FROM public.finance_sandbox_dispatches")
            assert cur.fetchone()[0] == 0
            cur.execute("SELECT count(*) FROM public.finance_paper_allocations")
            assert cur.fetchone()[0] == 0
            cur.execute(
                """
                SELECT sent, live_permitted, admitted
                FROM public.finance_production_dispatches
                WHERE id = %s
                """,
                (open_dispatch,),
            )
            assert cur.fetchone() == (False, False, False)
            cur.execute(
                """
                SELECT count(*) FROM public.finance_audit_log
                WHERE action = 'production_observed_result.recorded' AND subject_id = %s
                """,
                (filled_id,),
            )
            assert cur.fetchone()[0] == 1
            cur.execute(
                """
                SELECT count(*) FROM public.finance_audit_log
                WHERE action = 'production_observed_result.reconciled' AND subject_id = %s
                """,
                (filled_reconciliation,),
            )
            assert cur.fetchone()[0] == 1
            cur.execute("SAVEPOINT viewer_observe")
            as_user(member, USER_D)
            with pytest.raises(psycopg2.Error) as viewer_denied:
                _observe(cur, hold_contract, "filled")
            assert "not an organization writer" in _error_text(viewer_denied.value)
            cur.execute("ROLLBACK TO SAVEPOINT viewer_observe")
            as_user(member, USER_B)
        member.commit()
    finally:
        member.close()

    with psycopg2.connect(SUPER_DSN) as admin, admin.cursor() as cur:
        cur.execute("SAVEPOINT immutable_result")
        with pytest.raises(psycopg2.Error) as immutable_result:
            cur.execute(
                """
                UPDATE public.finance_observed_production_results
                SET sent = TRUE
                WHERE id = %s
                """,
                (filled_id,),
            )
        assert "production observed result is immutable" in _error_text(immutable_result.value)
        cur.execute("ROLLBACK TO SAVEPOINT immutable_result")
        cur.execute("SAVEPOINT immutable_reconciliation")
        with pytest.raises(psycopg2.Error) as immutable_reconciliation:
            cur.execute(
                """
                UPDATE public.finance_observed_result_reconciliations
                SET sent = TRUE
                WHERE id = %s
                """,
                (filled_reconciliation,),
            )
        assert "production observed reconciliation is immutable" in _error_text(immutable_reconciliation.value)
        cur.execute("ROLLBACK TO SAVEPOINT immutable_reconciliation")
        cur.execute(
            """
            SELECT observed.payload_digest = md5(public.finance_canonical_json(jsonb_build_object(
                       'authorization_digest', observed.authorization_digest,
                       'contract_digest', observed.contract_digest,
                       'execution_identity', observed.execution_identity,
                       'instrument', observed.instrument,
                       'quantity', observed.quantity,
                       'side', observed.side
                   )))
               AND observed.authorization_digest = grants.authorization_digest
               AND observed.contract_digest = md5(public.finance_canonical_json(contracts.contract))
               AND observed.payload_digest = dispatches.payload_digest
               AND observed.sent = FALSE
               AND observed.live_permitted = FALSE
            FROM public.finance_observed_production_results observed
            JOIN public.finance_production_dispatches dispatches ON dispatches.id = observed.dispatch_id
            JOIN public.finance_execution_contracts contracts ON contracts.id = observed.contract_id
            JOIN public.finance_production_authorizations grants
              ON grants.id = dispatches.production_authorization_id
            WHERE observed.id = %s
            """,
            (filled_id,),
        )
        assert cur.fetchone()[0] is True
        admin.commit()

    outsider = psycopg2.connect(APP_DSN)
    outsider.autocommit = False
    try:
        as_user(outsider, USER_C)
        with outsider.cursor() as cur:
            cur.execute("SELECT count(*) FROM public.finance_observed_production_results")
            assert cur.fetchone()[0] == 0
            with pytest.raises(psycopg2.Error) as outsider_denied:
                _observe(cur, open_contract, "filled")
            assert "not an organization writer" in _error_text(outsider_denied.value)
        outsider.rollback()
    finally:
        outsider.close()

    assert timeout_dispatch != open_dispatch
    assert rejected_dispatch != open_dispatch
    assert accepted_dispatch != open_dispatch
    assert late_dispatch != open_dispatch

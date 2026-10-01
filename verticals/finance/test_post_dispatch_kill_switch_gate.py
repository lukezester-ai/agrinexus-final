import json
import os

import psycopg2
import pytest

from engine.test_book import ALWAYS_LONG
from test_integration_gate import ORG_A, ORG_B, USER_A, USER_B, USER_C, USER_D, as_user
from test_observed_result_gate import _dispatch, _error_text, _hold, _observe
from test_observed_result_gate import _reconcile as _reconcile_observed
from test_order_intent_recheck_gate import _bars, _policy
from test_production_result_gate import _reconcile as _reconcile_external
from test_production_result_gate import _result

SUPER_DSN = os.environ.get("DB_URL_SUPERUSER")
APP_DSN = os.environ.get("DB_URL_APPUSER")

pytestmark = pytest.mark.skipif(
    not SUPER_DSN or not APP_DSN,
    reason="DB_URL_SUPERUSER and DB_URL_APPUSER are required",
)

GUARDED = (
    "finance_record_observed_production_result",
    "finance_reconcile_observed_production_result",
    "finance_record_production_external_result",
    "finance_reconcile_production_result",
)


def _prepare_in(cur, instrument_id, name, organization_id):
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
        (organization_id, json.dumps(_policy(name))),
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
    cur.execute("SELECT public.finance_pass_production_safety(%s, '{}'::jsonb)", (contract_id,))
    cur.fetchone()
    return contract_id


def _deny(cur, call):
    cur.execute("SAVEPOINT denied")
    with pytest.raises(psycopg2.Error) as denied:
        call()
    assert "production kill switch is engaged" in _error_text(denied.value)
    cur.execute("ROLLBACK TO SAVEPOINT denied")


def _identity(cur, dispatch_id):
    cur.execute(
        "SELECT execution_identity FROM public.finance_production_dispatches WHERE id = %s",
        (dispatch_id,),
    )
    return cur.fetchone()[0]


def _audit_count(cur, action, identity):
    cur.execute(
        """
        SELECT count(*) FROM public.finance_audit_log
        WHERE action = %s AND details->>'execution_identity' = %s
        """,
        (action, identity),
    )
    return cur.fetchone()[0]


def test_engaged_switch_stops_a_later_result_without_changing_the_stored_one():
    with psycopg2.connect(SUPER_DSN) as admin, admin.cursor() as cur:
        cur.execute(
            """
            SELECT p.proname, p.prosrc
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname = ANY(%s)
            """,
            (list(GUARDED) + ["finance_assert_production_kill_switch_clear", "finance_record_production_dispatch"],),
        )
        sources = dict(cur.fetchall())
        for name in GUARDED:
            assert "finance_assert_production_kill_switch_clear" in sources[name]
            for forbidden in (
                "broker",
                "urllib",
                "http",
                "credential",
                "endpoint",
                "live_order",
                "live_permitted = TRUE",
                "sent = TRUE",
                "finance_record_production_authorization",
            ):
                assert forbidden not in sources[name]
        assert "finance_production_kill_switches" in sources["finance_assert_production_kill_switch_clear"]
        assert "finance_assert_production_kill_switch_clear" not in sources["finance_record_production_dispatch"]
        assert "production kill switch is engaged" in sources["finance_record_production_dispatch"]
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
            kept_contract = _hold(cur, instrument_id, "Kept")[1]
            open_contract = _hold(cur, instrument_id, "Open")[1]
            bare_contract = _hold(cur, instrument_id, "Bare")[1]
            kept_external_contract = _hold(cur, instrument_id, "KeptExternal")[1]
            open_external_contract = _hold(cur, instrument_id, "OpenExternal")[1]
            bare_external_contract = _hold(cur, instrument_id, "BareExternal")[1]
            hold_contract = _hold(cur, instrument_id, "Hold")[1]

            kept_dispatch = _dispatch(cur, kept_contract)
            open_dispatch = _dispatch(cur, open_contract)
            bare_dispatch = _dispatch(cur, bare_contract)
            kept_external_dispatch = _dispatch(cur, kept_external_contract)
            open_external_dispatch = _dispatch(cur, open_external_contract)
            bare_external_dispatch = _dispatch(cur, bare_external_contract)
            kept_id = _observe(cur, kept_contract, "filled")
            kept_reconciliation = _reconcile_observed(cur, kept_contract)
            open_id = _observe(cur, open_contract, "filled")
            kept_external_id = _result(cur, kept_external_contract)
            kept_external_reconciliation = _reconcile_external(cur, kept_external_contract)
            open_external_id = _result(cur, open_external_contract)

            cur.execute(
                """
                SELECT external_result, success, admitted, sent, live_permitted
                FROM public.finance_observed_production_results WHERE id = %s
                """,
                (kept_id,),
            )
            assert cur.fetchone() == ("filled", True, False, False, False)
            cur.execute(
                """
                SELECT sent, live_permitted, admitted
                FROM public.finance_production_dispatches WHERE id = %s
                """,
                (bare_dispatch,),
            )
            assert cur.fetchone() == (False, False, False)

            cur.execute(
                "SELECT public.finance_engage_production_kill_switch(%s, '{}'::jsonb)",
                (kept_contract,),
            )
            cur.fetchone()

            _deny(cur, lambda: _observe(cur, bare_contract, "filled"))
            assert _audit_count(cur, "production_observed_result.recorded", _identity(cur, bare_dispatch)) == 0
            cur.execute(
                "SELECT count(*) FROM public.finance_observed_production_results WHERE dispatch_id = %s",
                (bare_dispatch,),
            )
            assert cur.fetchone()[0] == 0

            _deny(cur, lambda: _reconcile_observed(cur, open_contract))
            assert _audit_count(cur, "production_observed_result.reconciled", _identity(cur, open_dispatch)) == 0
            cur.execute(
                "SELECT count(*) FROM public.finance_observed_result_reconciliations WHERE dispatch_id = %s",
                (open_dispatch,),
            )
            assert cur.fetchone()[0] == 0
            cur.execute(
                """
                SELECT external_result, success, admitted, sent, live_permitted
                FROM public.finance_observed_production_results WHERE id = %s
                """,
                (open_id,),
            )
            assert cur.fetchone() == ("filled", True, False, False, False)

            _deny(cur, lambda: _result(cur, bare_external_contract))
            assert _audit_count(cur, "production_external_result.recorded", _identity(cur, bare_external_dispatch)) == 0
            cur.execute(
                "SELECT count(*) FROM public.finance_production_external_results WHERE dispatch_id = %s",
                (bare_external_dispatch,),
            )
            assert cur.fetchone()[0] == 0

            _deny(cur, lambda: _reconcile_external(cur, open_external_contract))
            assert _audit_count(
                cur, "production_result.reconciled", _identity(cur, open_external_dispatch)
            ) == 0
            cur.execute(
                "SELECT count(*) FROM public.finance_production_result_reconciliations WHERE dispatch_id = %s",
                (open_external_dispatch,),
            )
            assert cur.fetchone()[0] == 0
            cur.execute(
                "SELECT external_result, success FROM public.finance_production_external_results WHERE id = %s",
                (open_external_id,),
            )
            assert cur.fetchone() == ("unobserved", False)

            assert _observe(cur, kept_contract, "filled") == kept_id
            assert _reconcile_observed(cur, kept_contract) == kept_reconciliation
            assert _result(cur, kept_external_contract) == kept_external_id
            assert _reconcile_external(cur, kept_external_contract) == kept_external_reconciliation
            cur.execute("SAVEPOINT conflicting_result")
            with pytest.raises(psycopg2.Error) as conflicting_result:
                _observe(cur, kept_contract, "rejected")
            assert "production result does not match" in _error_text(conflicting_result.value)
            cur.execute("ROLLBACK TO SAVEPOINT conflicting_result")

            _deny(cur, lambda: _dispatch(cur, hold_contract))
            cur.execute("SELECT count(*) FROM public.finance_production_dispatches")
            assert cur.fetchone()[0] == 6

            as_user(member, USER_C)
            cur.execute("SELECT public.finance_create_instrument(%s, %s, %s)", (ORG_B, "ACME", "Acme"))
            other_instrument = cur.fetchone()[0]
            cur.execute(
                "SELECT public.finance_replace_market_bars(%s, %s::jsonb)",
                (other_instrument, json.dumps(_bars())),
            )
            cur.fetchone()
            other_contract = _prepare_in(cur, other_instrument, "Other", ORG_B)
            other_dispatch = _dispatch(cur, other_contract)
            other_id = _observe(cur, other_contract, "filled")
            other_reconciliation = _reconcile_observed(cur, other_contract)
            cur.execute(
                """
                SELECT external_result, success, admitted, sent, live_permitted
                FROM public.finance_observed_production_results WHERE id = %s
                """,
                (other_id,),
            )
            assert cur.fetchone() == ("filled", True, False, False, False)
            cur.execute(
                "SELECT organization_id FROM public.finance_production_dispatches WHERE id = %s",
                (other_dispatch,),
            )
            assert str(cur.fetchone()[0]) == ORG_B
            cur.execute(
                "SELECT comparison FROM public.finance_observed_result_reconciliations WHERE id = %s",
                (other_reconciliation,),
            )
            assert cur.fetchone()[0] == "matched"
            cur.execute("SELECT count(*) FROM public.finance_production_kill_switches WHERE organization_id = %s", (ORG_B,))
            assert cur.fetchone()[0] == 0
            cur.execute(
                """
                SELECT external_result, success, admitted, sent, live_permitted
                FROM public.finance_observed_production_results WHERE id = %s
                """,
                (kept_id,),
            )
            assert cur.fetchone() == ("filled", True, False, False, False)
        member.commit()
    finally:
        member.close()

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
    "finance_cancel_production_authorization",
)


def _error_text(error: BaseException) -> str:
    return getattr(error, "pgerror", None) or str(error)


def _authorize(cur, instrument_id, name):
    policy_id, intent_id, _intent_digest = _prepare(cur, instrument_id, name)
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
        "SELECT public.finance_record_production_authorization(%s, '{}'::jsonb)",
        (contract_id,),
    )
    production_id = cur.fetchone()[0]
    return policy_id, contract_id, production_id


def _pass(cur, contract_id):
    cur.execute(
        "SELECT public.finance_pass_production_safety(%s, '{}'::jsonb)",
        (contract_id,),
    )
    return cur.fetchone()[0]


def _engage(cur, contract_id):
    cur.execute(
        "SELECT public.finance_engage_production_kill_switch(%s, '{}'::jsonb)",
        (contract_id,),
    )
    return cur.fetchone()[0]


def test_kill_switch_stops_a_valid_production_authorization():
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
                  'finance_production_safety_controls',
                  'finance_production_kill_switches'
              )
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
                    "finance_pass_production_safety",
                    "finance_engage_production_kill_switch",
                    *BLOCKED_CALLERS,
                ],
            ),
        )
        sources = dict(cur.fetchall())
        for name in ("finance_pass_production_safety", "finance_engage_production_kill_switch"):
            source = sources[name]
            for forbidden in (
                "finance_live_boundary",
                "finance_production_execution",
                "finance_begin_sandbox_dispatch",
                "finance_apply_paper_book",
                "finance_evaluate_risk_policy",
                "finance_risk_policies",
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
        assert "finance_match_production_authorization" in sources["finance_pass_production_safety"]
        assert "finance_match_production_authorization" not in sources["finance_engage_production_kill_switch"]
        assert "production kill switch is engaged" in sources["finance_pass_production_safety"]
        for name in BLOCKED_CALLERS:
            assert "finance_pass_production_safety" not in sources[name]
            assert "finance_engage_production_kill_switch" not in sources[name]
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
            open_policy, open_contract, open_production = _authorize(cur, instrument_id, "Open")
            held_id = _pass(cur, open_contract)
            assert _pass(cur, open_contract) == held_id
            cur.execute(
                """
                SELECT organization_id, contract_id::text, production_authorization_id::text,
                       order_quantity, exposure_value, order_limit, exposure_limit, allowed_targets,
                       material_withheld, timeout_is_success, max_retries, switch_clear, decision,
                       admitted, created_by
                FROM public.finance_production_safety_controls
                WHERE id = %s
                """,
                (held_id,),
            )
            row = cur.fetchone()
            assert row[0] == ORG_A
            assert row[1] == str(open_contract)
            assert row[2] == str(open_production)
            assert row[3] == 1
            assert row[4] > 0
            assert row[4] <= 10000
            assert row[5] == 1
            assert row[6] == 10000
            assert row[7] == []
            assert row[8] is True
            assert row[9] is False
            assert row[10] == 0
            assert row[11] is True
            assert row[12] == "held"
            assert row[13] is False
            assert row[14] == USER_B
            cur.execute("SELECT policy->>'max_exposure' FROM public.finance_risk_policies WHERE id = %s", (open_policy,))
            assert cur.fetchone()[0] != "10000"
            cur.execute("SAVEPOINT client_control")
            with pytest.raises(psycopg2.Error) as client_control:
                cur.execute(
                    "SELECT public.finance_pass_production_safety(%s, %s::jsonb)",
                    (open_contract, json.dumps({"admitted": True})),
                )
            assert "production safety is invalid" in _error_text(client_control.value)
            cur.execute("ROLLBACK TO SAVEPOINT client_control")

            _flat_policy, flat_contract, _flat_production = _authorize(cur, instrument_id, "Flat")
            cur.execute(
                "SELECT public.finance_cancel_production_authorization(%s, '{}'::jsonb)",
                (flat_contract,),
            )
            cur.fetchone()
            cur.execute("SAVEPOINT cancelled_safety")
            with pytest.raises(psycopg2.Error) as cancelled_safety:
                _pass(cur, flat_contract)
            assert "production authorization cancelled" in _error_text(cancelled_safety.value)
            cur.execute("ROLLBACK TO SAVEPOINT cancelled_safety")

            wait_policy, wait_contract, _wait_production = _authorize(cur, instrument_id, "Wait")
            cur.execute(
                "SELECT public.finance_replace_risk_policy(%s, %s::jsonb)",
                (wait_policy, json.dumps(_policy("Wait", max_drawdown=0.5))),
            )
            cur.fetchone()
            cur.execute("SAVEPOINT stale_safety")
            with pytest.raises(psycopg2.Error) as stale_safety:
                _pass(cur, wait_contract)
            assert "production authorization does not match" in _error_text(stale_safety.value)
            cur.execute("ROLLBACK TO SAVEPOINT stale_safety")

            _hold_policy, hold_contract, _hold_production = _authorize(cur, instrument_id, "Hold")
            switch_id = _engage(cur, open_contract)
            assert _engage(cur, hold_contract) == switch_id
            cur.execute("SAVEPOINT killed_open")
            with pytest.raises(psycopg2.Error) as killed_open:
                _pass(cur, open_contract)
            assert "production kill switch is engaged" in _error_text(killed_open.value)
            cur.execute("ROLLBACK TO SAVEPOINT killed_open")
            cur.execute("SAVEPOINT killed_hold")
            with pytest.raises(psycopg2.Error) as killed_hold:
                _pass(cur, hold_contract)
            assert "production kill switch is engaged" in _error_text(killed_hold.value)
            cur.execute("ROLLBACK TO SAVEPOINT killed_hold")
            cur.execute("SELECT count(*) FROM public.finance_production_safety_controls")
            assert cur.fetchone()[0] == 1
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
                WHERE action = 'production_safety.held' AND subject_id = %s
                """,
                (held_id,),
            )
            assert cur.fetchone()[0] == 1
            cur.execute(
                """
                SELECT count(*)
                FROM public.finance_audit_log
                WHERE action = 'production_kill_switch.engaged' AND subject_id = %s
                """,
                (switch_id,),
            )
            assert cur.fetchone()[0] == 1
            cur.execute("SELECT engaged FROM public.finance_production_kill_switches WHERE id = %s", (switch_id,))
            assert cur.fetchone()[0] is True
            cur.execute("SAVEPOINT viewer_safety")
            as_user(member, USER_D)
            with pytest.raises(psycopg2.Error) as viewer_denied:
                _pass(cur, hold_contract)
            assert "not an organization writer" in _error_text(viewer_denied.value)
            cur.execute("ROLLBACK TO SAVEPOINT viewer_safety")
            as_user(member, USER_B)
        member.commit()
    finally:
        member.close()

    with psycopg2.connect(SUPER_DSN) as admin, admin.cursor() as cur:
        cur.execute("SAVEPOINT immutable_safety")
        with pytest.raises(psycopg2.Error) as immutable:
            cur.execute(
                """
                UPDATE public.finance_production_safety_controls
                SET admitted = TRUE
                WHERE id = %s
                """,
                (held_id,),
            )
        assert "production safety is immutable" in _error_text(immutable.value)
        cur.execute("ROLLBACK TO SAVEPOINT immutable_safety")
        cur.execute("SAVEPOINT immutable_switch")
        with pytest.raises(psycopg2.Error) as immutable_switch:
            cur.execute(
                """
                UPDATE public.finance_production_kill_switches
                SET engaged = FALSE
                WHERE id = %s
                """,
                (switch_id,),
            )
        assert "production kill switch is immutable" in _error_text(immutable_switch.value) or "check" in _error_text(immutable_switch.value).lower()
        cur.execute("ROLLBACK TO SAVEPOINT immutable_switch")
        admin.commit()

    outsider = psycopg2.connect(APP_DSN)
    outsider.autocommit = False
    try:
        as_user(outsider, USER_C)
        with outsider.cursor() as cur:
            cur.execute("SELECT count(*) FROM public.finance_production_safety_controls")
            assert cur.fetchone()[0] == 0
            cur.execute("SELECT count(*) FROM public.finance_production_kill_switches")
            assert cur.fetchone()[0] == 0
            with pytest.raises(psycopg2.Error) as outsider_denied:
                _pass(cur, open_contract)
            assert "not an organization writer" in _error_text(outsider_denied.value)
        outsider.rollback()
    finally:
        outsider.close()

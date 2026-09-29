import json
import os

import psycopg2
import pytest

from test_integration_gate import ORG_A, ORG_B, USER_A, USER_B, USER_C, USER_D, as_user
from test_order_intent_recheck_gate import _bars, _prepare

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
)


def _error_text(error: BaseException) -> str:
    return getattr(error, "pgerror", None) or str(error)


def _protocol(cur, contract_id, event):
    cur.execute(
        "SELECT public.finance_sandbox_protocol(%s, %s, %s::jsonb)",
        (contract_id, event, "{}"),
    )
    return cur.fetchone()[0]


def _bind(cur, instrument_id, name):
    _policy_id, intent_id, _intent_digest = _prepare(cur, instrument_id, name)
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
        SELECT execution_identity, contract
        FROM public.finance_execution_contracts
        WHERE id = %s
        """,
        (contract_id,),
    )
    identity, contract = cur.fetchone()
    return contract_id, identity, contract


def test_sandbox_protocol_records_states_and_does_not_send():
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
            SELECT pg_get_constraintdef(pg_constraint.oid)
            FROM pg_constraint
            JOIN pg_class ON pg_class.oid = pg_constraint.conrelid
            JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
            WHERE pg_namespace.nspname = 'public'
              AND pg_class.relname = 'finance_sandbox_protocols'
              AND pg_constraint.contype = 'c'
            """
        )
        checks = " ".join(row[0] for row in cur.fetchall())
        for forbidden in ("executed", "filled", "success"):
            assert forbidden not in checks
        assert "accepted" in checks and "timeout" in checks and "rejected" in checks
        cur.execute(
            """
            SELECT p.proname, p.prosrc
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname = ANY(%s)
            """,
            (["finance_sandbox_protocol", *BLOCKED_CALLERS],),
        )
        sources = dict(cur.fetchall())
        protocol_source = sources["finance_sandbox_protocol"]
        assert "finance_execution_contracts" in protocol_source
        assert "UPDATE public.finance_execution_contracts" not in protocol_source
        for name in (
            "finance_create_execution_contract",
            "finance_apply_paper_book",
            "finance_paper_allocations",
            "finance_create_order_intent",
            "finance_evaluate_risk_policy",
            "finance_gateway_boundary",
            "metrics_from_equity",
            "peak",
            "broker",
            "live_order",
            "execution_gateway",
            "http",
            "dblink",
            "executed",
            "filled",
        ):
            assert name not in protocol_source
        for name in BLOCKED_CALLERS:
            assert "finance_sandbox_protocol" not in sources[name]
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
            acknowledged_id, acknowledged_identity, acknowledged_contract = _bind(cur, instrument_id, "Open")
            rejected_id, rejected_identity, rejected_contract = _bind(cur, instrument_id, "Hold")
            timeout_id, timeout_identity, timeout_contract = _bind(cur, instrument_id, "Flat")
            cur.execute("SELECT count(*) FROM public.finance_execution_contracts")
            assert cur.fetchone()[0] == 3
            cur.execute("SAVEPOINT missing_contract")
            with pytest.raises(psycopg2.Error) as missing:
                _protocol(cur, "00000000-0000-0000-0000-000000000099", "open")
            assert "execution contract not found" in _error_text(missing.value)
            cur.execute("ROLLBACK TO SAVEPOINT missing_contract")
            for event, payload in (
                ("execute", {}),
                ("open", {"status": "filled"}),
                ("open", {"instrument": "OTHER"}),
                ("timeout", {"result": "success"}),
                ("broker", {}),
            ):
                cur.execute("SAVEPOINT rejected_protocol")
                with pytest.raises(psycopg2.Error) as rejected_event:
                    cur.execute(
                        "SELECT public.finance_sandbox_protocol(%s, %s, %s::jsonb)",
                        (acknowledged_id, event, json.dumps(payload)),
                    )
                assert "sandbox protocol is invalid" in _error_text(rejected_event.value)
                cur.execute("ROLLBACK TO SAVEPOINT rejected_protocol")

            cur.execute("SAVEPOINT viewer_protocol")
            as_user(member, USER_D)
            with pytest.raises(psycopg2.Error) as viewer_denied:
                _protocol(cur, acknowledged_id, "open")
            assert "not an organization writer" in _error_text(viewer_denied.value)
            cur.execute("ROLLBACK TO SAVEPOINT viewer_protocol")
            cur.execute("SAVEPOINT outsider_protocol")
            as_user(member, USER_C)
            with pytest.raises(psycopg2.Error) as outsider_denied:
                _protocol(cur, acknowledged_id, "open")
            assert "not an organization writer" in _error_text(outsider_denied.value)
            cur.execute("ROLLBACK TO SAVEPOINT outsider_protocol")
            as_user(member, USER_B)

            first_ack = _protocol(cur, acknowledged_id, "open")
            assert _protocol(cur, acknowledged_id, "open") == first_ack
            cur.execute(
                """
                SELECT organization_id, contract_id::text, execution_identity, expected_contract,
                       status, result_status, result_known, reconciliation_required, opened_by
                FROM public.finance_sandbox_protocols
                WHERE id = %s
                """,
                (first_ack,),
            )
            assert cur.fetchone() == (
                ORG_A,
                str(acknowledged_id),
                acknowledged_identity,
                acknowledged_contract,
                "accepted",
                "pending",
                False,
                False,
                USER_B,
            )
            assert _protocol(cur, acknowledged_id, "acknowledge") == first_ack
            assert _protocol(cur, acknowledged_id, "acknowledge") == first_ack
            cur.execute(
                """
                SELECT status, result_status, result_known, reconciliation_required
                FROM public.finance_sandbox_protocols
                WHERE id = %s
                """,
                (first_ack,),
            )
            assert cur.fetchone() == ("acknowledged", "pending", False, False)
            cur.execute(
                """
                SELECT count(*)
                FROM public.finance_audit_log
                WHERE action = 'sandbox_protocol.accepted' AND subject_id = %s
                """,
                (first_ack,),
            )
            assert cur.fetchone()[0] == 1

            first_reject = _protocol(cur, rejected_id, "open")
            assert _protocol(cur, rejected_id, "reject") == first_reject
            assert _protocol(cur, rejected_id, "open") == first_reject
            assert _protocol(cur, rejected_id, "reject") == first_reject
            cur.execute(
                """
                SELECT status, result_status, result_known
                FROM public.finance_sandbox_protocols
                WHERE execution_identity = %s
                """,
                (rejected_identity,),
            )
            assert cur.fetchone() == ("rejected", "rejected", True)
            cur.execute("SELECT count(*) FROM public.finance_sandbox_protocols WHERE execution_identity = %s", (rejected_identity,))
            assert cur.fetchone()[0] == 1
            cur.execute("SAVEPOINT reject_is_terminal")
            with pytest.raises(psycopg2.Error) as reject_ack:
                _protocol(cur, rejected_id, "acknowledge")
            assert "sandbox protocol is rejected" in _error_text(reject_ack.value)
            cur.execute("ROLLBACK TO SAVEPOINT reject_is_terminal")
            cur.execute("SAVEPOINT reject_blocks_timeout")
            with pytest.raises(psycopg2.Error) as reject_timeout:
                _protocol(cur, rejected_id, "timeout")
            assert "sandbox protocol is rejected" in _error_text(reject_timeout.value)
            cur.execute("ROLLBACK TO SAVEPOINT reject_blocks_timeout")

            first_timeout = _protocol(cur, timeout_id, "open")
            assert _protocol(cur, timeout_id, "timeout") == first_timeout
            assert _protocol(cur, timeout_id, "timeout") == first_timeout
            cur.execute(
                """
                SELECT status, result_status, result_known, reconciliation_required, expected_contract
                FROM public.finance_sandbox_protocols
                WHERE id = %s
                """,
                (first_timeout,),
            )
            assert cur.fetchone() == ("timeout", "unknown", False, True, timeout_contract)
            cur.execute("SAVEPOINT timeout_is_unknown")
            with pytest.raises(psycopg2.Error) as timeout_reject:
                _protocol(cur, timeout_id, "reject")
            assert "sandbox protocol is unknown" in _error_text(timeout_reject.value)
            cur.execute("ROLLBACK TO SAVEPOINT timeout_is_unknown")
            cur.execute("SAVEPOINT reconcile_before_timeout")
            with pytest.raises(psycopg2.Error) as early_reconcile:
                _protocol(cur, acknowledged_id, "reconcile")
            assert "sandbox reconciliation is not required" in _error_text(early_reconcile.value)
            cur.execute("ROLLBACK TO SAVEPOINT reconcile_before_timeout")
            assert _protocol(cur, timeout_id, "reconcile") == first_timeout
            assert _protocol(cur, timeout_id, "reconcile") == first_timeout
            cur.execute(
                """
                SELECT execution_identity, expected_contract, observed_contract, comparison
                FROM public.finance_sandbox_reconciliations
                WHERE protocol_id = %s
                """,
                (first_timeout,),
            )
            assert cur.fetchone() == (timeout_identity, timeout_contract, None, "unobserved")
            cur.execute(
                """
                SELECT status, result_status, result_known
                FROM public.finance_sandbox_protocols
                WHERE id = %s
                """,
                (first_timeout,),
            )
            assert cur.fetchone() == ("timeout", "unknown", False)
            cur.execute(
                """
                SELECT id::text, execution_identity, contract
                FROM public.finance_execution_contracts
                WHERE id IN (%s, %s, %s)
                """,
                (acknowledged_id, rejected_id, timeout_id),
            )
            assert sorted(cur.fetchall(), key=lambda row: row[0]) == sorted(
                [
                    (str(acknowledged_id), acknowledged_identity, acknowledged_contract),
                    (str(rejected_id), rejected_identity, rejected_contract),
                    (str(timeout_id), timeout_identity, timeout_contract),
                ],
                key=lambda row: row[0],
            )
            cur.execute("SELECT count(*) FROM public.finance_paper_allocations")
            assert cur.fetchone()[0] == 0
            cur.execute("SELECT count(*) FROM public.finance_sandbox_protocols")
            assert cur.fetchone()[0] == 3
            cur.execute("SAVEPOINT direct_update")
            with pytest.raises(psycopg2.Error):
                cur.execute(
                    "UPDATE public.finance_sandbox_protocols SET status = 'accepted' WHERE id = %s",
                    (first_reject,),
                )
            cur.execute("ROLLBACK TO SAVEPOINT direct_update")
        member.commit()
    finally:
        member.close()

    with psycopg2.connect(SUPER_DSN) as admin, admin.cursor() as cur:
        cur.execute("SAVEPOINT immutable_protocol")
        with pytest.raises(psycopg2.Error) as immutable:
            cur.execute(
                "UPDATE public.finance_sandbox_protocols SET execution_identity = %s WHERE id = %s",
                ("0" * 32, first_reject),
            )
        assert "sandbox protocol is immutable" in _error_text(immutable.value)
        cur.execute("ROLLBACK TO SAVEPOINT immutable_protocol")
        cur.execute("SAVEPOINT rejected_protocol")
        with pytest.raises(psycopg2.Error) as reopened:
            cur.execute(
                "UPDATE public.finance_sandbox_protocols SET status = 'accepted', result_status = 'pending', result_known = FALSE WHERE id = %s",
                (first_reject,),
            )
        assert "sandbox protocol is rejected" in _error_text(reopened.value)
        cur.execute("ROLLBACK TO SAVEPOINT rejected_protocol")
        admin.commit()

    outsider = psycopg2.connect(APP_DSN)
    outsider.autocommit = False
    try:
        as_user(outsider, USER_C)
        with outsider.cursor() as cur:
            cur.execute("SELECT count(*) FROM public.finance_sandbox_protocols")
            assert cur.fetchone()[0] == 0
        outsider.commit()
    finally:
        outsider.close()

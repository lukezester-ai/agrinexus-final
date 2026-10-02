import json
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import psycopg2
import pytest

from engine.reconciliation import reconcile_observation
from engine.sandbox_adapter import SANDBOX_ENDPOINT, dispatch_sandbox
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
    "finance_sandbox_protocol",
    "finance_begin_sandbox_dispatch",
    "finance_finish_sandbox_dispatch",
)


def _error_text(error: BaseException) -> str:
    return getattr(error, "pgerror", None) or str(error)


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
        "SELECT execution_identity, contract FROM public.finance_execution_contracts WHERE id = %s",
        (contract_id,),
    )
    identity, contract = cur.fetchone()
    return contract_id, identity, contract


def _reconcile(cur, contract_id):
    cur.execute(
        "SELECT public.finance_reconcile_sandbox_execution(%s, '{}'::jsonb)",
        (contract_id,),
    )
    return cur.fetchone()[0]


class _SandboxHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length)
        self.server.requests.append(raw)
        body = json.loads(raw.decode("utf-8"))
        status = self.server.outcomes[body["execution_identity"]]
        payload = json.dumps({"status": status}).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, _format, *_args):
        return


def test_reconciliation_records_a_sent_sandbox_outcome_and_does_not_send_again():
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
            SELECT pg_get_constraintdef(pg_constraint.oid)
            FROM pg_constraint
            JOIN pg_class ON pg_class.oid = pg_constraint.conrelid
            JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
            WHERE pg_namespace.nspname = 'public'
              AND pg_class.relname = 'finance_execution_reconciliations'
              AND pg_constraint.contype = 'c'
            """
        )
        checks = " ".join(row[0] for row in cur.fetchall())
        for forbidden in ("filled", "matched"):
            assert forbidden not in checks
        cur.execute(
            """
            SELECT p.proname, p.prosrc
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname = ANY(%s)
            """,
            (["finance_reconcile_sandbox_execution", *BLOCKED_CALLERS],),
        )
        sources = dict(cur.fetchall())
        source = sources["finance_reconcile_sandbox_execution"]
        assert "finance_sandbox_dispatches" in source
        assert "UPDATE public.finance_execution_contracts" not in source
        assert "UPDATE public.finance_sandbox_dispatches" not in source
        for name in (
            "finance_begin_sandbox_dispatch",
            "finance_finish_sandbox_dispatch",
            "finance_gateway_boundary",
            "finance_apply_paper_book",
            "finance_evaluate_risk_policy",
            "urllib",
            "http",
            "live_order",
            "execution_gateway",
            "api_key",
            "password",
            "secret",
            "credential",
        ):
            assert name not in source
        for name in BLOCKED_CALLERS:
            assert "finance_reconcile_sandbox_execution" not in sources[name]
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
            names = ("Open", "Hold", "Flat", "Wait", "Halt")
            outcomes = ("accepted", "acknowledged", "rejected", "timeout", "unknown")
            bound = {}
            for name in names:
                bound[name] = _bind(cur, instrument_id, name)
            cur.execute("SAVEPOINT missing_dispatch")
            with pytest.raises(psycopg2.Error) as missing:
                _reconcile(cur, bound["Open"][0])
            assert "sandbox dispatch not found" in _error_text(missing.value)
            cur.execute("ROLLBACK TO SAVEPOINT missing_dispatch")
            for name in names:
                cur.execute(
                    "SELECT public.finance_sandbox_protocol(%s, 'open', '{}'::jsonb)",
                    (bound[name][0],),
                )
                cur.fetchone()
            cur.execute("SAVEPOINT client_record")
            with pytest.raises(psycopg2.Error) as client_record:
                cur.execute(
                    "SELECT public.finance_reconcile_sandbox_execution(%s, %s::jsonb)",
                    (bound["Open"][0], json.dumps({"observed_outcome": "acknowledged"})),
                )
            assert "sandbox reconciliation is invalid" in _error_text(client_record.value)
            cur.execute("ROLLBACK TO SAVEPOINT client_record")
            bound["Pause"] = _bind(cur, instrument_id, "Pause")
            cur.execute(
                "SELECT public.finance_sandbox_protocol(%s, 'open', '{}'::jsonb)",
                (bound["Pause"][0],),
            )
            cur.fetchone()
            cur.execute(
                "SELECT dispatch_id FROM public.finance_begin_sandbox_dispatch(%s, '{}'::jsonb)",
                (bound["Pause"][0],),
            )
            cur.fetchone()
            cur.execute("SAVEPOINT incomplete_dispatch")
            with pytest.raises(psycopg2.Error) as incomplete:
                _reconcile(cur, bound["Pause"][0])
            assert "sandbox dispatch is incomplete" in _error_text(incomplete.value)
            cur.execute("ROLLBACK TO SAVEPOINT incomplete_dispatch")
        member.commit()
    finally:
        member.close()

    server = ThreadingHTTPServer(("127.0.0.1", 54345), _SandboxHandler)
    server.requests = []
    server.outcomes = {bound[name][1]: outcome for name, outcome in zip(names, outcomes)}
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        member = psycopg2.connect(APP_DSN)
        member.autocommit = False
        try:
            as_user(member, USER_B)
            with member.cursor() as cur:
                for name in names:
                    assert dispatch_sandbox(cur, bound[name][0], {})["sent"] is True
                sent = len(server.requests)
                assert sent == 5
                record_ids = {}
                for name, outcome in zip(names, outcomes):
                    record_ids[name] = _reconcile(cur, bound[name][0])
                    assert _reconcile(cur, bound[name][0]) == record_ids[name]
                    expected = reconcile_observation(outcome)
                    cur.execute(
                        """
                        SELECT records.organization_id, records.contract_id::text, records.execution_identity,
                               records.expected_contract, records.observed_outcome, records.comparison,
                               records.result_known, records.created_by
                        FROM public.finance_execution_reconciliations records
                        WHERE records.id = %s
                        """,
                        (record_ids[name],),
                    )
                    assert cur.fetchone() == (
                        ORG_A,
                        str(bound[name][0]),
                        bound[name][1],
                        bound[name][2],
                        expected["observed_outcome"],
                        expected["comparison"],
                        expected["result_known"],
                        USER_B,
                    )
                    cur.execute(
                        "SELECT contract FROM public.finance_execution_contracts WHERE id = %s",
                        (bound[name][0],),
                    )
                    assert cur.fetchone()[0] == bound[name][2]
                assert len(server.requests) == sent
                cur.execute("SAVEPOINT viewer_reconcile")
                as_user(member, USER_D)
                with pytest.raises(psycopg2.Error) as viewer_denied:
                    _reconcile(cur, bound["Open"][0])
                assert "not an organization writer" in _error_text(viewer_denied.value)
                cur.execute("ROLLBACK TO SAVEPOINT viewer_reconcile")
                as_user(member, USER_B)
                cur.execute("SELECT count(*) FROM public.finance_sandbox_dispatches")
                assert cur.fetchone()[0] == 6
                cur.execute("SELECT count(*) FROM public.finance_execution_reconciliations")
                assert cur.fetchone()[0] == 5
                cur.execute("SELECT count(*) FROM public.finance_paper_allocations")
                assert cur.fetchone()[0] == 0
                cur.execute(
                    """
                    SELECT count(*)
                    FROM public.finance_audit_log
                    WHERE action = 'sandbox_reconciliation.recorded' AND subject_id = %s
                    """,
                    (record_ids["Wait"],),
                )
                assert cur.fetchone()[0] == 1
                cur.execute("SAVEPOINT direct_update")
                with pytest.raises(psycopg2.Error):
                    cur.execute(
                        """
                        UPDATE public.finance_execution_reconciliations
                        SET comparison = 'pending'
                        WHERE id = %s
                        """,
                        (record_ids["Wait"],),
                    )
                cur.execute("ROLLBACK TO SAVEPOINT direct_update")
            member.commit()
        finally:
            member.close()
    finally:
        server.shutdown()
        server.server_close()

    with psycopg2.connect(SUPER_DSN) as admin, admin.cursor() as cur:
        cur.execute("SAVEPOINT immutable_record")
        with pytest.raises(psycopg2.Error) as immutable:
            cur.execute(
                """
                UPDATE public.finance_execution_reconciliations
                SET observed_outcome = 'acknowledged', comparison = 'pending', result_known = FALSE
                WHERE id = %s
                """,
                (record_ids["Wait"],),
            )
        assert "sandbox reconciliation is immutable" in _error_text(immutable.value)
        cur.execute("ROLLBACK TO SAVEPOINT immutable_record")
        admin.commit()

    outsider = psycopg2.connect(APP_DSN)
    outsider.autocommit = False
    try:
        as_user(outsider, USER_C)
        with outsider.cursor() as cur:
            cur.execute("SELECT count(*) FROM public.finance_execution_reconciliations")
            assert cur.fetchone()[0] == 0
            with pytest.raises(psycopg2.Error) as outsider_denied:
                _reconcile(cur, bound["Open"][0])
            assert "not an organization writer" in _error_text(outsider_denied.value)
        outsider.rollback()
    finally:
        outsider.close()

    assert SANDBOX_ENDPOINT == "http://127.0.0.1:54345/sandbox"

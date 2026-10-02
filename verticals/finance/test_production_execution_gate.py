import json
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import psycopg2
import pytest

from engine.production_execution import refuse_observation
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
    "finance_reconcile_sandbox_execution",
    "finance_live_boundary",
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


def _open(cur, contract_id):
    cur.execute(
        "SELECT public.finance_sandbox_protocol(%s, 'open', '{}'::jsonb)",
        (contract_id,),
    )
    cur.fetchone()


def _reconcile(cur, contract_id):
    cur.execute(
        "SELECT public.finance_reconcile_sandbox_execution(%s, '{}'::jsonb)",
        (contract_id,),
    )
    cur.fetchone()


def _live(cur, contract_id):
    cur.execute(
        "SELECT public.finance_live_boundary(%s, '{}'::jsonb)",
        (contract_id,),
    )
    cur.fetchone()


def _refuse(cur, contract_id):
    cur.execute(
        "SELECT public.finance_production_execution(%s, '{}'::jsonb)",
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


def test_production_execution_refuses_a_blocked_boundary_and_does_not_send():
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
              AND table_name = 'finance_production_refusals'
              AND column_name ~* 'broker|endpoint|api_key|secret|password|credential'
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
              AND pg_class.relname = 'finance_production_refusals'
              AND pg_constraint.contype = 'c'
            """
        )
        checks = " ".join(row[0] for row in cur.fetchall())
        for forbidden in ("filled", "success"):
            assert forbidden not in checks
        assert "refused" in checks
        cur.execute(
            """
            SELECT p.proname, p.prosrc
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname = ANY(%s)
            """,
            (["finance_production_execution", *BLOCKED_CALLERS],),
        )
        sources = dict(cur.fetchall())
        source = sources["finance_production_execution"]
        assert "finance_live_boundaries" in source
        assert "finance_live_boundary(" not in source
        assert "UPDATE public.finance_execution_contracts" not in source
        assert "UPDATE public.finance_live_boundaries" not in source
        for name in (
            "finance_begin_sandbox_dispatch",
            "finance_finish_sandbox_dispatch",
            "finance_gateway_boundary",
            "finance_apply_paper_book",
            "finance_evaluate_risk_policy",
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
            assert name not in source
        for name in BLOCKED_CALLERS:
            assert "finance_production_execution" not in sources[name]
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
            cur.execute("SAVEPOINT missing_boundary")
            with pytest.raises(psycopg2.Error) as missing:
                _refuse(cur, bound["Open"][0])
            assert "live boundary not found" in _error_text(missing.value)
            cur.execute("ROLLBACK TO SAVEPOINT missing_boundary")
            for name in names:
                _open(cur, bound[name][0])
            cur.execute("SAVEPOINT client_execution")
            with pytest.raises(psycopg2.Error) as client_execution:
                cur.execute(
                    "SELECT public.finance_production_execution(%s, %s::jsonb)",
                    (bound["Open"][0], json.dumps({"sent": True})),
                )
            assert "production execution is invalid" in _error_text(client_execution.value)
            cur.execute("ROLLBACK TO SAVEPOINT client_execution")
            bound["Pause"] = _bind(cur, instrument_id, "Pause")
            _open(cur, bound["Pause"][0])
            cur.execute(
                "SELECT dispatch_id FROM public.finance_begin_sandbox_dispatch(%s, '{}'::jsonb)",
                (bound["Pause"][0],),
            )
            cur.fetchone()
            cur.execute("SAVEPOINT unfinished_boundary")
            with pytest.raises(psycopg2.Error) as unfinished:
                _refuse(cur, bound["Pause"][0])
            assert "live boundary not found" in _error_text(unfinished.value)
            cur.execute("ROLLBACK TO SAVEPOINT unfinished_boundary")
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
                    _reconcile(cur, bound[name][0])
                    _live(cur, bound[name][0])
                sent = len(server.requests)
                assert sent == 5
                refusal_ids = {}
                for name, outcome in zip(names, outcomes):
                    refusal_ids[name] = _refuse(cur, bound[name][0])
                    assert _refuse(cur, bound[name][0]) == refusal_ids[name]
                    expected = refuse_observation(outcome)
                    cur.execute(
                        """
                        SELECT refusals.organization_id, refusals.contract_id::text,
                               refusals.execution_identity, refusals.expected_contract,
                               refusals.observed_outcome, refusals.decision, refusals.sent,
                               refusals.created_by
                        FROM public.finance_production_refusals refusals
                        WHERE refusals.id = %s
                        """,
                        (refusal_ids[name],),
                    )
                    assert cur.fetchone() == (
                        ORG_A,
                        str(bound[name][0]),
                        bound[name][1],
                        bound[name][2],
                        expected["observed_outcome"],
                        expected["decision"],
                        expected["sent"],
                        USER_B,
                    )
                    cur.execute(
                        """
                        SELECT boundaries.decision, boundaries.live_permitted, contracts.contract
                        FROM public.finance_live_boundaries boundaries
                        JOIN public.finance_execution_contracts contracts
                          ON contracts.id = boundaries.contract_id
                        WHERE boundaries.contract_id = %s
                        """,
                        (bound[name][0],),
                    )
                    assert cur.fetchone() == ("blocked", False, bound[name][2])
                assert len(server.requests) == sent
                cur.execute("SAVEPOINT viewer_execution")
                as_user(member, USER_D)
                with pytest.raises(psycopg2.Error) as viewer_denied:
                    _refuse(cur, bound["Open"][0])
                assert "not an organization writer" in _error_text(viewer_denied.value)
                cur.execute("ROLLBACK TO SAVEPOINT viewer_execution")
                as_user(member, USER_B)
                cur.execute("SELECT count(*) FROM public.finance_sandbox_dispatches")
                assert cur.fetchone()[0] == 6
                cur.execute("SELECT count(*) FROM public.finance_live_boundaries")
                assert cur.fetchone()[0] == 5
                cur.execute("SELECT count(*) FROM public.finance_production_refusals")
                assert cur.fetchone()[0] == 5
                cur.execute("SELECT count(*) FROM public.finance_paper_allocations")
                assert cur.fetchone()[0] == 0
                cur.execute(
                    """
                    SELECT count(*)
                    FROM public.finance_audit_log
                    WHERE action = 'production_execution.refused' AND subject_id = %s
                    """,
                    (refusal_ids["Wait"],),
                )
                assert cur.fetchone()[0] == 1
                cur.execute("SAVEPOINT direct_update")
                with pytest.raises(psycopg2.Error):
                    cur.execute(
                        """
                        UPDATE public.finance_production_refusals
                        SET decision = 'refused'
                        WHERE id = %s
                        """,
                        (refusal_ids["Wait"],),
                    )
                cur.execute("ROLLBACK TO SAVEPOINT direct_update")
            member.commit()
        finally:
            member.close()
    finally:
        server.shutdown()
        server.server_close()

    with psycopg2.connect(SUPER_DSN) as admin, admin.cursor() as cur:
        cur.execute("SAVEPOINT immutable_refusal")
        with pytest.raises(psycopg2.Error) as immutable:
            cur.execute(
                """
                UPDATE public.finance_production_refusals
                SET sent = TRUE
                WHERE id = %s
                """,
                (refusal_ids["Wait"],),
            )
        assert "production execution is immutable" in _error_text(immutable.value)
        cur.execute("ROLLBACK TO SAVEPOINT immutable_refusal")
        admin.commit()

    outsider = psycopg2.connect(APP_DSN)
    outsider.autocommit = False
    try:
        as_user(outsider, USER_C)
        with outsider.cursor() as cur:
            cur.execute("SELECT count(*) FROM public.finance_production_refusals")
            assert cur.fetchone()[0] == 0
            with pytest.raises(psycopg2.Error) as outsider_denied:
                _refuse(cur, bound["Open"][0])
            assert "not an organization writer" in _error_text(outsider_denied.value)
        outsider.rollback()
    finally:
        outsider.close()

    assert SANDBOX_ENDPOINT == "http://127.0.0.1:54345/sandbox"

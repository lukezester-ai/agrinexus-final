import json
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import psycopg2
import pytest

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


class _SandboxHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length)
        self.server.requests.append((self.path, dict(self.headers.items()), raw))
        if self.path != "/sandbox":
            self.send_error(404)
            return
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


def test_sandbox_adapter_reaches_only_the_configured_sandbox():
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
              AND table_name = 'finance_sandbox_dispatches'
              AND column_name ~* 'credential|api_key|secret|password'
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
            (["finance_begin_sandbox_dispatch", "finance_finish_sandbox_dispatch", *BLOCKED_CALLERS],),
        )
        sources = dict(cur.fetchall())
        begin_source = sources["finance_begin_sandbox_dispatch"]
        finish_source = sources["finance_finish_sandbox_dispatch"]
        assert SANDBOX_ENDPOINT in begin_source
        assert "https://" not in begin_source
        assert "finance_sandbox_protocol" in finish_source
        for source in (begin_source, finish_source):
            for name in (
                "finance_gateway_boundary",
                "finance_create_execution_contract",
                "finance_apply_paper_book",
                "finance_evaluate_risk_policy",
                "finance_create_order_intent",
                "api_key",
                "password",
                "secret",
                "credential",
                "live_order",
                "execution_gateway",
            ):
                assert name not in source
        for name in BLOCKED_CALLERS:
            assert "finance_begin_sandbox_dispatch" not in sources[name]
            assert "finance_finish_sandbox_dispatch" not in sources[name]
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
                contract_id, identity, contract = _bind(cur, instrument_id, name)
                bound[name] = (contract_id, identity, contract)
            cur.execute(
                "SELECT public.finance_sandbox_protocol(%s, 'open', '{}'::jsonb)",
                (bound["Open"][0],),
            )
            cur.fetchone()
            cur.execute("SAVEPOINT missing_protocol")
            with pytest.raises(psycopg2.Error) as missing:
                cur.execute(
                    "SELECT * FROM public.finance_begin_sandbox_dispatch(%s, '{}'::jsonb)",
                    (bound["Hold"][0],),
                )
            assert "sandbox protocol not found" in _error_text(missing.value)
            cur.execute("ROLLBACK TO SAVEPOINT missing_protocol")
            for name in names:
                cur.execute(
                    "SELECT public.finance_sandbox_protocol(%s, 'open', '{}'::jsonb)",
                    (bound[name][0],),
                )
                cur.fetchone()
            cur.execute("SAVEPOINT client_endpoint")
            with pytest.raises(psycopg2.Error) as client_endpoint:
                cur.execute(
                    "SELECT * FROM public.finance_begin_sandbox_dispatch(%s, %s::jsonb)",
                    (bound["Open"][0], json.dumps({"endpoint": "https://api.example/orders"})),
                )
            assert "sandbox adapter is invalid" in _error_text(client_endpoint.value)
            cur.execute("ROLLBACK TO SAVEPOINT client_endpoint")
            cur.execute("SAVEPOINT viewer_adapter")
            as_user(member, USER_D)
            with pytest.raises(psycopg2.Error) as viewer_denied:
                cur.execute(
                    "SELECT * FROM public.finance_begin_sandbox_dispatch(%s, '{}'::jsonb)",
                    (bound["Open"][0],),
                )
            assert "not an organization writer" in _error_text(viewer_denied.value)
            cur.execute("ROLLBACK TO SAVEPOINT viewer_adapter")
            as_user(member, USER_B)
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
                results = {}
                for name in names:
                    results[name] = dispatch_sandbox(cur, bound[name][0], {})
                for name in names:
                    again = dispatch_sandbox(cur, bound[name][0], {})
                    assert again["sent"] is False
                    assert again["outcome"] == results[name]["outcome"]
                    assert again["endpoint"] == SANDBOX_ENDPOINT
                assert [item["sent"] for item in results.values()] == [True, True, True, True, True]
                assert [item["outcome"] for item in results.values()] == list(outcomes)
                assert len(server.requests) == 5
                for path, headers, raw in server.requests:
                    assert path == "/sandbox"
                    assert "Authorization" not in headers
                    body = json.loads(raw.decode("utf-8"))
                    assert set(body) == {"execution_identity", "expected_contract"}
                    assert "price" not in body["expected_contract"]
                    assert "venue" not in body["expected_contract"]
                cur.execute(
                    """
                    SELECT contracts.contract, protocols.status, protocols.result_status, protocols.result_known,
                               dispatches.sandbox_url, dispatches.outcome
                    FROM public.finance_execution_contracts contracts
                    JOIN public.finance_sandbox_protocols protocols ON protocols.contract_id = contracts.id
                    JOIN public.finance_sandbox_dispatches dispatches ON dispatches.contract_id = contracts.id
                    WHERE contracts.id = %s
                    """,
                    (bound["Wait"][0],),
                )
                contract, status, result_status, result_known, endpoint, outcome = cur.fetchone()
                assert contract == bound["Wait"][2]
                assert (status, result_status, result_known, endpoint, outcome) == (
                    "timeout",
                    "unknown",
                    False,
                    SANDBOX_ENDPOINT,
                    "timeout",
                )
                cur.execute(
                    """
                    SELECT status, result_status, result_known
                    FROM public.finance_sandbox_protocols
                    WHERE contract_id = %s
                    """,
                    (bound["Halt"][0],),
                )
                assert cur.fetchone() == ("timeout", "unknown", False)
                cur.execute(
                    """
                    SELECT status, result_known
                    FROM public.finance_sandbox_protocols
                    WHERE contract_id = %s
                    """,
                    (bound["Open"][0],),
                )
                assert cur.fetchone() == ("accepted", False)
                cur.execute(
                    """
                    SELECT status, result_known
                    FROM public.finance_sandbox_protocols
                    WHERE contract_id = %s
                    """,
                    (bound["Hold"][0],),
                )
                assert cur.fetchone() == ("acknowledged", False)
                cur.execute(
                    """
                    SELECT status, result_status, result_known
                    FROM public.finance_sandbox_protocols
                    WHERE contract_id = %s
                    """,
                    (bound["Flat"][0],),
                )
                assert cur.fetchone() == ("rejected", "rejected", True)
                cur.execute("SAVEPOINT timeout_cannot_succeed")
                with pytest.raises(psycopg2.Error) as changed:
                    cur.execute(
                        "SELECT public.finance_finish_sandbox_dispatch(%s, 'acknowledged')",
                        (bound["Wait"][0],),
                    )
                assert "sandbox adapter does not match" in _error_text(changed.value)
                cur.execute("ROLLBACK TO SAVEPOINT timeout_cannot_succeed")
                cur.execute(
                    "SELECT public.finance_sandbox_protocol(%s, 'reconcile', '{}'::jsonb)",
                    (bound["Wait"][0],),
                )
                cur.fetchone()
                cur.execute(
                    """
                    SELECT reconciliations.expected_contract, reconciliations.observed_contract,
                           reconciliations.comparison
                    FROM public.finance_sandbox_reconciliations reconciliations
                    JOIN public.finance_sandbox_protocols protocols ON protocols.id = reconciliations.protocol_id
                    WHERE protocols.contract_id = %s
                    """,
                    (bound["Wait"][0],),
                )
                assert cur.fetchone() == (bound["Wait"][2], None, "unobserved")
                cur.execute(
                    """
                    SELECT contract FROM public.finance_execution_contracts WHERE id = %s
                    """,
                    (bound["Wait"][0],),
                )
                assert cur.fetchone()[0] == bound["Wait"][2]
                cur.execute("SELECT count(*) FROM public.finance_paper_allocations")
                assert cur.fetchone()[0] == 0
                cur.execute("SELECT count(*) FROM public.finance_sandbox_dispatches")
                assert cur.fetchone()[0] == 5
                cur.execute(
                    """
                    SELECT count(*)
                    FROM public.finance_audit_log
                    WHERE action = 'sandbox_adapter.timeout'
                    """
                )
                assert cur.fetchone()[0] == 1
            member.commit()
        finally:
            member.close()
    finally:
        server.shutdown()
        server.server_close()

    with psycopg2.connect(SUPER_DSN) as admin, admin.cursor() as cur:
        cur.execute("SAVEPOINT production_endpoint")
        with pytest.raises(psycopg2.Error) as production:
            cur.execute(
                """
                UPDATE public.finance_sandbox_dispatches
                SET sandbox_url = 'https://api.example/orders'
                WHERE execution_identity = %s
                """,
                (bound["Open"][1],),
            )
        assert "production endpoint is impossible" in _error_text(production.value)
        cur.execute("ROLLBACK TO SAVEPOINT production_endpoint")
        admin.commit()

from pathlib import Path

import pytest

from engine.sandbox_adapter import (
    SANDBOX_ENDPOINT,
    SandboxAdapterError,
    dispatch_sandbox,
    endpoint_allowed,
    interpret_sandbox_response,
    transmit,
    validate_adapter_command,
)


class _Response:
    def __init__(self, raw: bytes):
        self._raw = raw

    def read(self):
        return self._raw

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False


def test_only_the_configured_sandbox_endpoint_is_allowed():
    assert validate_adapter_command({}) == {}
    assert endpoint_allowed(SANDBOX_ENDPOINT) is True
    assert endpoint_allowed("https://api.example/orders") is False
    assert endpoint_allowed("http://127.0.0.1:54345/production") is False
    for document in (None, [], {"endpoint": "https://api.example/orders"}, {"price": "1"}, {"venue": "NYSE"}):
        with pytest.raises(SandboxAdapterError):
            validate_adapter_command(document)
    calls = []

    def opener(request, timeout):
        calls.append((request.full_url, request.header_items(), timeout))
        return _Response(b'{"status":"acknowledged"}')

    with pytest.raises(SandboxAdapterError, match="production endpoint is impossible"):
        transmit("https://api.example/orders", {"execution_identity": "a"}, opener)
    assert calls == []
    assert transmit(SANDBOX_ENDPOINT, {"execution_identity": "a"}, opener) == "acknowledged"
    assert calls[0][0] == SANDBOX_ENDPOINT
    assert all(name.lower() != "authorization" for name, _value in calls[0][1])
    assert interpret_sandbox_response(b'{"status":"timeout"}') == "timeout"
    assert interpret_sandbox_response(b'{"status":"filled"}') == "unknown"
    assert interpret_sandbox_response(b'{"status":"success"}') == "unknown"

    class _Cursor:
        def execute(self, *_args):
            raise AssertionError("network reservation must not start")

        def fetchone(self):
            return None

    with pytest.raises(SandboxAdapterError):
        dispatch_sandbox(_Cursor(), "00000000-0000-0000-0000-000000000099", {"endpoint": "https://api.example/orders"}, opener)
    assert len(calls) == 1


def test_adapter_has_no_production_credential_and_does_not_bypass_the_protocol():
    source = Path(__file__).with_name("sandbox_adapter.py").read_text(encoding="utf-8")
    for name in (
        "api_key",
        "secret",
        "password",
        "Bearer",
        "credential",
        "finance_apply_paper_book",
        "finance_create_order_intent",
        "finance_create_execution_contract",
        "finance_evaluate_risk_policy",
        "finance_gateway_boundary",
        "live_order",
        "execution_gateway",
    ):
        assert name not in source
    assert "finance_begin_sandbox_dispatch" in source
    assert "finance_finish_sandbox_dispatch" in source
    assert SANDBOX_ENDPOINT in source

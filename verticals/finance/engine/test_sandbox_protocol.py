from pathlib import Path

import pytest

from engine.sandbox_protocol import (
    SandboxProtocolError,
    apply_protocol,
    open_protocol,
    validate_protocol_command,
)


def test_same_contract_keeps_one_protocol_state():
    opened = open_protocol()
    assert apply_protocol(opened, "open") == opened
    acknowledged = apply_protocol(opened, "acknowledge")
    assert acknowledged["status"] == "acknowledged"
    assert acknowledged["result_known"] is False
    assert acknowledged["result_status"] == "pending"
    rejected = apply_protocol(opened, "reject")
    assert apply_protocol(rejected, "open") == rejected
    assert rejected["result_known"] is True
    with pytest.raises(SandboxProtocolError, match="rejected"):
        apply_protocol(rejected, "acknowledge")
    timed_out = apply_protocol(opened, "timeout")
    assert timed_out["status"] == "timeout"
    assert timed_out["result_status"] == "unknown"
    assert timed_out["result_known"] is False
    assert timed_out["reconciliation_required"] is True
    recorded = apply_protocol(timed_out, "reconcile")
    assert recorded["comparison"] == "unobserved"
    assert recorded["result_known"] is False
    assert recorded["status"] == "timeout"
    with pytest.raises(SandboxProtocolError, match="not required"):
        apply_protocol(opened, "reconcile")
    with pytest.raises(SandboxProtocolError, match="unknown"):
        apply_protocol(timed_out, "reject")


def test_client_cannot_supply_a_protocol_result():
    assert validate_protocol_command("open", {}) == {}
    for event, document in (
        ("execute", {}),
        ("open", {"status": "filled"}),
        ("open", {"instrument": "ACME"}),
        ("timeout", {"result": "success"}),
        (None, {}),
    ):
        with pytest.raises(SandboxProtocolError):
            validate_protocol_command(event, document)


def test_protocol_does_not_send():
    source = Path(__file__).with_name("sandbox_protocol.py").read_text(encoding="utf-8")
    for name in (
        "finance_apply_paper_book",
        "finance_create_order_intent",
        "finance_create_execution_contract",
        "finance_evaluate_risk_policy",
        "urllib",
        "requests",
        "socket",
        "http",
        "broker",
        "live_order",
        "execution_gateway",
        "filled",
        "executed",
    ):
        assert name not in source

from pathlib import Path

import pytest

from engine.production_result import (
    ProductionResultError,
    classify_observation,
    outcome_class,
    payload_digest,
    reconcile_result,
    record_dispatch,
    record_external_result,
    result_is_success,
    validate_result_command,
)


def _facts() -> dict:
    return {
        "execution_identity": "1" * 32,
        "instrument": "ACME",
        "side": "long",
        "quantity": "1.000000",
        "authorization_digest": "a" * 32,
        "contract_digest": "b" * 32,
    }


def test_unknown_is_not_success_and_dispatch_stays_unobserved():
    assert validate_result_command({}) == {}
    for observation in (None, "", "timeout", "missing", "not-a-result"):
        assert classify_observation(observation) == "unknown"
        assert result_is_success("unknown") is False
    assert outcome_class("unknown") == "unknown"
    assert outcome_class("accepted") == "unknown"
    assert outcome_class("partial") == "unknown"
    assert outcome_class("rejected") == "rejected"
    assert result_is_success("rejected") is False
    assert result_is_success("accepted") is False
    assert result_is_success("partial") is False
    assert result_is_success("unobserved") is False
    assert outcome_class("filled") == "success"
    assert result_is_success("filled") is True
    recorded = record_external_result("1" * 32)
    assert recorded["external_result"] == "unobserved"
    assert recorded["success"] is False
    dispatch = record_dispatch("1" * 32, kill_switch=False)
    assert dispatch == {"execution_identity": "1" * 32, "admitted": False, "sent": False, "live_permitted": False}
    assert record_dispatch("1" * 32, False, dispatch) is dispatch


def test_kill_switch_and_digest_change_block_the_result():
    with pytest.raises(ProductionResultError, match="kill switch"):
        record_dispatch("1" * 32, kill_switch=True)
    facts = _facts()
    digest = payload_digest(
        facts["execution_identity"],
        facts["instrument"],
        facts["side"],
        facts["quantity"],
        facts["authorization_digest"],
        facts["contract_digest"],
    )
    stored = {**facts, "payload_digest": digest, "external_result": "unobserved"}
    assert reconcile_result(stored, stored)["comparison"] == "unresolved"
    assert reconcile_result(stored, stored)["success"] is False
    changed = dict(stored)
    changed["quantity"] = "2.000000"
    with pytest.raises(ProductionResultError, match="does not match"):
        reconcile_result(stored, changed)
    assert payload_digest(
        facts["execution_identity"],
        facts["instrument"],
        facts["side"],
        "2.000000",
        facts["authorization_digest"],
        facts["contract_digest"],
    ) != digest


def test_client_cannot_supply_a_result():
    for document in (None, [], {"external_result": "filled"}, {"sent": True}, {"success": True}):
        with pytest.raises(ProductionResultError):
            validate_result_command(document)


def test_production_result_does_not_send():
    source = Path(__file__).with_name("production_result.py").read_text(encoding="utf-8")
    for name in (
        "urllib",
        "socket",
        "api_key",
        "secret",
        "password",
        "credential",
        "broker",
        "finance_live_boundary",
        "finance_begin_sandbox_dispatch",
        "live_order",
    ):
        assert name not in source

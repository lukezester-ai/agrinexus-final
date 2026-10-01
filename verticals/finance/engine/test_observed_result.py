from pathlib import Path

import pytest

from engine.observed_result import (
    ObservedResultError,
    classify_observed_result,
    reconcile_observed_result,
    record_observed_result,
    validate_observed_command,
)


def _stored(result: str) -> dict:
    return {
        "execution_identity": "1" * 32,
        "instrument": "ACME",
        "side": "long",
        "quantity": "1.000000",
        "authorization_digest": "a" * 32,
        "contract_digest": "b" * 32,
        "payload_digest": "c" * 32,
        "external_result": result,
        "success": result == "filled",
    }


def test_filled_can_be_observed_without_sending():
    assert validate_observed_command({}) == {}
    observed = record_observed_result("1" * 32, "filled")
    assert observed["external_result"] == "filled"
    assert observed["outcome_class"] == "success"
    assert observed["success"] is True
    assert observed["sent"] is False
    assert observed["live_permitted"] is False
    assert observed["admitted"] is False
    assert record_observed_result("1" * 32, "filled", observed) is observed
    reconciled = reconcile_observed_result(_stored("filled"), _stored("filled"))
    assert reconciled["comparison"] == "matched"
    assert reconciled["sent"] is False
    assert reconciled["live_permitted"] is False


def test_unknown_is_not_success_and_a_mismatch_is_rejected():
    for observation in ("timeout", "missing", "invalid"):
        assert classify_observed_result(observation) == "unknown"
    unknown = record_observed_result("1" * 32, "timeout")
    assert unknown["success"] is False
    assert unknown["outcome_class"] == "unknown"
    assert reconcile_observed_result(_stored("unknown"), _stored("unknown"))["comparison"] == "unresolved"
    assert reconcile_observed_result(_stored("rejected"), _stored("rejected"))["comparison"] == "terminal"
    changed = _stored("filled")
    changed["quantity"] = "2.000000"
    with pytest.raises(ObservedResultError, match="does not match"):
        reconcile_observed_result(_stored("filled"), changed)
    with pytest.raises(ObservedResultError, match="does not match"):
        record_observed_result("1" * 32, "unknown", record_observed_result("1" * 32, "filled"))


def test_kill_switch_stops_a_new_observation_and_keeps_the_stored_one():
    stored = record_observed_result("1" * 32, "filled")
    assert record_observed_result("1" * 32, "filled", stored, kill_switch=True) is stored
    with pytest.raises(ObservedResultError, match="kill switch"):
        record_observed_result("1" * 32, "filled", kill_switch=True)
    reconciled = reconcile_observed_result(_stored("filled"), _stored("filled"))
    assert reconcile_observed_result(_stored("filled"), _stored("filled"), reconciled, kill_switch=True) is reconciled
    with pytest.raises(ObservedResultError, match="kill switch"):
        reconcile_observed_result(_stored("filled"), _stored("filled"), kill_switch=True)
    changed = _stored("filled")
    changed["quantity"] = "2.000000"
    with pytest.raises(ObservedResultError, match="does not match"):
        reconcile_observed_result(_stored("filled"), changed, kill_switch=True)


def test_client_cannot_supply_an_observation_body():
    for document in (None, [], {"external_result": "filled"}, {"sent": True}):
        with pytest.raises(ObservedResultError):
            validate_observed_command(document)
    with pytest.raises(ObservedResultError):
        classify_observed_result("broker")


def test_observed_result_does_not_send():
    source = Path(__file__).with_name("observed_result.py").read_text(encoding="utf-8")
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

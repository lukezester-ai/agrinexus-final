from pathlib import Path

import pytest

from engine.reconciliation import (
    SandboxReconciliationError,
    reconcile_observation,
    validate_reconciliation_command,
)


def test_each_outcome_has_one_comparison_and_repeat_is_identical():
    assert validate_reconciliation_command({}) == {}
    accepted = reconcile_observation("accepted")
    assert accepted == reconcile_observation("accepted")
    assert accepted["result_known"] is False
    assert accepted["comparison"] == "pending"
    acknowledged = reconcile_observation("acknowledged")
    assert acknowledged["result_known"] is False
    assert acknowledged["comparison"] == "pending"
    assert reconcile_observation("rejected") == {
        "observed_outcome": "rejected",
        "comparison": "terminal",
        "result_known": True,
    }
    for outcome in ("timeout", "unknown"):
        recorded = reconcile_observation(outcome)
        assert recorded == reconcile_observation(outcome)
        assert recorded["comparison"] == "unresolved"
        assert recorded["result_known"] is False
    for document in (None, [], {"observed_outcome": "acknowledged"}, {"comparison": "matched"}):
        with pytest.raises(SandboxReconciliationError):
            validate_reconciliation_command(document)
    with pytest.raises(SandboxReconciliationError):
        reconcile_observation("filled")


def test_reconciliation_does_not_send():
    source = Path(__file__).with_name("reconciliation.py").read_text(encoding="utf-8")
    for name in (
        "urllib",
        "http",
        "socket",
        "api_key",
        "secret",
        "password",
        "Bearer",
        "credential",
        "finance_begin_sandbox_dispatch",
        "finance_apply_paper_book",
        "finance_evaluate_risk_policy",
        "finance_gateway_boundary",
        "live_order",
        "execution_gateway",
        "filled",
        "matched",
    ):
        assert name not in source

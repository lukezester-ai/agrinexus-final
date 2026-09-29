from pathlib import Path

import pytest

from engine.production_execution import (
    ProductionExecutionError,
    refuse_observation,
    validate_production_command,
)


def test_every_outcome_is_refused_and_repeat_is_identical():
    assert validate_production_command({}) == {}
    for outcome in ("accepted", "acknowledged", "rejected", "timeout", "unknown"):
        recorded = refuse_observation(outcome)
        assert recorded == refuse_observation(outcome)
        assert recorded["decision"] == "refused"
        assert recorded["sent"] is False
    for document in (None, [], {"decision": "sent"}, {"sent": True}):
        with pytest.raises(ProductionExecutionError):
            validate_production_command(document)
    with pytest.raises(ProductionExecutionError):
        refuse_observation("filled")


def test_production_execution_does_not_send():
    source = Path(__file__).with_name("production_execution.py").read_text(encoding="utf-8")
    for name in (
        "urllib",
        "http",
        "socket",
        "api_key",
        "secret",
        "password",
        "Bearer",
        "credential",
        "broker",
        "finance_begin_sandbox_dispatch",
        "finance_apply_paper_book",
        "finance_evaluate_risk_policy",
        "finance_gateway_boundary",
        "finance_live_boundary",
        "live_order",
        "execution_gateway",
        "filled",
        "success",
    ):
        assert name not in source

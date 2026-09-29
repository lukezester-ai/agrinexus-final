from pathlib import Path

import pytest

from engine.live_boundary import (
    LiveBoundaryError,
    bound_observation,
    validate_live_boundary_command,
)


def test_every_outcome_stays_blocked_and_repeat_is_identical():
    assert validate_live_boundary_command({}) == {}
    for outcome in ("accepted", "acknowledged", "rejected", "timeout", "unknown"):
        recorded = bound_observation(outcome)
        assert recorded == bound_observation(outcome)
        assert recorded["decision"] == "blocked"
        assert recorded["live_permitted"] is False
    for document in (None, [], {"decision": "allowed"}, {"live_permitted": True}):
        with pytest.raises(LiveBoundaryError):
            validate_live_boundary_command(document)
    with pytest.raises(LiveBoundaryError):
        bound_observation("filled")


def test_live_boundary_does_not_send():
    source = Path(__file__).with_name("live_boundary.py").read_text(encoding="utf-8")
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
        "finance_reconcile_sandbox_execution",
        "live_order",
        "execution_gateway",
        "filled",
        "success",
    ):
        assert name not in source

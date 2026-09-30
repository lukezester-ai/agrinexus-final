from pathlib import Path

import pytest

from engine.production_safety import (
    ALLOWED_TARGETS,
    EXPOSURE_LIMIT,
    MAX_RETRIES,
    ORDER_LIMIT,
    ProductionSafetyError,
    pass_production_safety,
    target_allowed,
    validate_safety_command,
)


def test_a_clear_authorization_is_held_once():
    assert validate_safety_command({}) == {}
    assert ALLOWED_TARGETS == ()
    assert target_allowed("http://127.0.0.1:54345/sandbox") is False
    assert target_allowed("https://broker.example/orders") is False
    held = pass_production_safety("1" * 32, 1, 124, kill_switch=False)
    assert held["decision"] == "held"
    assert held["admitted"] is False
    assert held["order_limit"] == ORDER_LIMIT == 1
    assert held["exposure_limit"] == EXPOSURE_LIMIT == 10000
    assert held["allowed_targets"] == []
    assert held["material_withheld"] is True
    assert held["timeout_is_success"] is False
    assert held["max_retries"] == MAX_RETRIES == 0
    assert pass_production_safety("1" * 32, 1, 124, False, held) is held


def test_kill_switch_blocks_a_valid_authorization():
    with pytest.raises(ProductionSafetyError, match="kill switch"):
        pass_production_safety("1" * 32, 1, 124, kill_switch=True)
    with pytest.raises(ProductionSafetyError, match="limit exceeded"):
        pass_production_safety("1" * 32, 2, 124, kill_switch=False)
    with pytest.raises(ProductionSafetyError, match="limit exceeded"):
        pass_production_safety("1" * 32, 1, 10001, kill_switch=False)


def test_client_cannot_supply_a_safety_control():
    for document in (None, [], {"admitted": True}, {"kill_switch": False}, {"target": "desk"}):
        with pytest.raises(ProductionSafetyError):
            validate_safety_command(document)


def test_production_safety_does_not_send():
    source = Path(__file__).with_name("production_safety.py").read_text(encoding="utf-8")
    for name in (
        "urllib",
        "socket",
        "api_key",
        "secret",
        "password",
        "credential",
        "broker",
        "finance_live_boundary",
        "finance_production_execution",
        "finance_begin_sandbox_dispatch",
        "live_permitted",
        "live_order",
    ):
        assert name not in source

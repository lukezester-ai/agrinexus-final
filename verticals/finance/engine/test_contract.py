from pathlib import Path

import pytest

from engine.contract import (
    ExecutionContractError,
    canonical_execution_contract,
    execution_identity,
    validate_execution_command,
)


def _contract(instrument: str = "ACME") -> dict:
    return canonical_execution_contract(
        "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "c" * 32,
        "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        "a" * 32,
        "b" * 32,
        instrument,
        "long",
        "1.000000",
    )


def test_empty_command_repeats_for_the_same_authorization():
    assert validate_execution_command({}) == {}
    first = _contract()
    assert execution_identity(first) == execution_identity(_contract())
    assert execution_identity(first) != execution_identity(_contract("OTHER"))
    assert set(first) == {
        "authorization_id",
        "authorization_digest",
        "intent_id",
        "intent_digest",
        "evaluation_digest",
        "instrument",
        "side",
        "quantity",
    }
    assert "price" not in first
    assert "venue" not in first


def test_client_cannot_supply_an_order():
    for document in (
        None,
        [],
        {"instrument": "ACME"},
        {"side": "long"},
        {"quantity": "9.000000"},
        {"price": "1"},
        {"venue": "NYSE"},
        {"broker": "desk"},
        {"order": {}},
    ):
        with pytest.raises(ExecutionContractError):
            validate_execution_command(document)


def test_contract_does_not_send():
    source = Path(__file__).with_name("contract.py").read_text(encoding="utf-8")
    for name in (
        "finance_apply_paper_book",
        "finance_create_order_intent",
        "finance_authorize_order_intent",
        "finance_gateway_boundary",
        "finance_evaluate_risk_policy",
        "urllib",
        "requests",
        "socket",
        "http",
        "broker",
        "live_order",
        "execution_gateway",
    ):
        assert name not in source

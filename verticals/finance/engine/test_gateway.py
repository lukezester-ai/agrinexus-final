from pathlib import Path

import pytest

from engine.gateway import (
    GatewayBoundaryError,
    canonical_gateway_boundary,
    gateway_digest,
    validate_gateway_command,
)


def _boundary(authorization_digest: str = "c" * 32) -> dict:
    return canonical_gateway_boundary(
        "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        authorization_digest,
        "a" * 32,
        "b" * 32,
    )


def test_empty_command_repeats_for_the_same_authorization():
    assert validate_gateway_command({}) == {}
    first = _boundary()
    assert gateway_digest(first) == gateway_digest(_boundary())
    assert gateway_digest(first) != gateway_digest(_boundary("d" * 32))
    assert set(first) == {
        "authorization_id",
        "authorization_digest",
        "intent_digest",
        "evaluation_digest",
    }


def test_client_cannot_supply_an_order():
    for document in (
        None,
        [],
        {"authorization_digest": "c" * 32},
        {"broker": "desk"},
        {"price": "1"},
        {"venue": "NYSE"},
        {"order": {}},
        {"note": "send"},
    ):
        with pytest.raises(GatewayBoundaryError):
            validate_gateway_command(document)


def test_gateway_does_not_send():
    source = Path(__file__).with_name("gateway.py").read_text(encoding="utf-8")
    for name in (
        "finance_apply_paper_book",
        "finance_create_order_intent",
        "finance_authorize_order_intent",
        "finance_match_order_authorization",
        "finance_evaluate_risk_policy",
        "finance_recheck_order_intent",
        "metrics_from_equity",
        "peak",
        "broker",
        "live_order",
        "execution_gateway",
    ):
        assert name not in source

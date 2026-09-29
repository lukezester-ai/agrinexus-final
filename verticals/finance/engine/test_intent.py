from decimal import Decimal
from pathlib import Path

import pytest

from engine.intent import OrderIntentError, canonical_order_intent, intent_digest, validate_intent_command


def _intent(quantity: str = "1.000000") -> dict:
    return canonical_order_intent(
        "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "ACME",
        Decimal(quantity),
        "a" * 32,
        "b" * 32,
        "c" * 32,
        "d" * 32,
        "e" * 32,
    )


def test_empty_command_is_canonical_and_repeats():
    assert validate_intent_command({}) == {}
    first = _intent()
    assert first["side"] == "long"
    assert first["quantity"] == "1.000000"
    assert intent_digest(first) == intent_digest(_intent())
    assert intent_digest(first) != intent_digest(_intent("2.000000"))
    flat = canonical_order_intent(
        "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "ACME",
        Decimal("0"),
        "a" * 32,
        "b" * 32,
        "c" * 32,
        "d" * 32,
        "e" * 32,
    )
    assert flat["side"] == ""
    assert "price" not in first
    assert "venue" not in first
    assert "broker" not in first


def test_client_cannot_supply_an_order():
    for document in (
        None,
        [],
        {"quantity": "9"},
        {"price": "1"},
        {"venue": "NYSE"},
        {"broker": "live"},
        {"side": "long"},
        {"instrument": "ACME"},
    ):
        with pytest.raises(OrderIntentError):
            validate_intent_command(document)


def test_intent_does_not_send_or_recheck():
    source = Path(__file__).with_name("intent.py").read_text(encoding="utf-8")
    for name in (
        "finance_apply_paper_book",
        "finance_approve_strategy_result",
        "finance_evaluate_risk_policy",
        "metrics_from_equity",
        "run_spec_book",
        "peak",
    ):
        assert name not in source

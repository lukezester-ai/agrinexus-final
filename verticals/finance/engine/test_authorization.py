from pathlib import Path

import pytest

from engine.authorization import (
    OrderAuthorizationError,
    authorization_digest,
    canonical_order_authorization,
    validate_authorization_command,
)


def _authorization(intent_digest: str = "a" * 32) -> dict:
    return canonical_order_authorization(
        "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        intent_digest,
        "b" * 32,
    )


def test_empty_command_repeats_for_the_same_intent():
    assert validate_authorization_command({}) == {}
    first = _authorization()
    assert authorization_digest(first) == authorization_digest(_authorization())
    assert authorization_digest(first) != authorization_digest(_authorization("c" * 32))
    assert set(first) == {"intent_id", "intent_digest", "evaluation_digest"}


def test_client_cannot_supply_an_authorization():
    for document in (None, [], {"intent_digest": "a" * 32}, {"broker": "desk"}, {"note": "send"}):
        with pytest.raises(OrderAuthorizationError):
            validate_authorization_command(document)


def test_authorization_does_not_send():
    source = Path(__file__).with_name("authorization.py").read_text(encoding="utf-8")
    for name in (
        "finance_apply_paper_book",
        "finance_evaluate_risk_policy",
        "finance_recheck_order_intent",
        "metrics_from_equity",
        "peak",
        "gateway",
    ):
        assert name not in source

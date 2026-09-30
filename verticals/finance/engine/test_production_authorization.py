from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from engine.production_authorization import (
    AUTHORIZATION_TTL,
    EXPIRES_IN,
    ProductionAuthorizationError,
    cancel_production_authorization,
    canonical_production_authorization,
    match_production_authorization,
    production_authorization_digest,
    validate_production_authorization_command,
)


def _current() -> dict:
    return {
        "execution_identity": "1" * 32,
        "intent_digest": "a" * 32,
        "evaluation_digest": "b" * 32,
        "policy_digest": "c" * 32,
        "authorization_digest": "d" * 32,
    }


def _stored(now: datetime) -> dict:
    current = _current()
    document = canonical_production_authorization(
        current["execution_identity"],
        current["intent_digest"],
        current["evaluation_digest"],
        current["policy_digest"],
        current["authorization_digest"],
    )
    return {
        **current,
        "expires_in": EXPIRES_IN,
        "production_authorization_digest": production_authorization_digest(document),
        "authorized_at": now,
        "expires_at": now + AUTHORIZATION_TTL,
        "lifecycle": "recorded",
        "reason": None,
    }


def test_same_identity_repeats_and_differs_from_order_authorization():
    assert validate_production_authorization_command({}) == {}
    now = datetime(2024, 1, 1, tzinfo=timezone.utc)
    stored = _stored(now)
    assert match_production_authorization(stored, _current(), now) == stored
    assert stored["production_authorization_digest"] != stored["authorization_digest"]
    assert stored["expires_at"] - stored["authorized_at"] == AUTHORIZATION_TTL
    assert set(canonical_production_authorization("1", "a", "b", "c", "d")) == {
        "authorization_digest",
        "evaluation_digest",
        "execution_identity",
        "expires_in",
        "intent_digest",
        "policy_digest",
    }


def test_digest_expiry_and_cancellation_invalidate_the_record():
    now = datetime(2024, 1, 1, tzinfo=timezone.utc)
    stored = _stored(now)
    for key in (
        "execution_identity",
        "intent_digest",
        "evaluation_digest",
        "policy_digest",
        "authorization_digest",
    ):
        changed = dict(_current())
        changed[key] = "e" * 32
        with pytest.raises(ProductionAuthorizationError, match="does not match"):
            match_production_authorization(stored, changed, now)
    with pytest.raises(ProductionAuthorizationError, match="expired"):
        match_production_authorization(stored, _current(), now + AUTHORIZATION_TTL)
    cancelled = cancel_production_authorization(stored)
    assert cancelled["production_authorization_digest"] == stored["production_authorization_digest"]
    assert cancelled["lifecycle"] == "cancelled"
    assert cancelled["reason"] == "cancelled"
    assert cancel_production_authorization(cancelled) == cancelled
    with pytest.raises(ProductionAuthorizationError, match="cancelled"):
        match_production_authorization(cancelled, _current(), now)


def test_client_cannot_supply_a_production_authorization():
    for document in (
        None,
        [],
        {"execution_identity": "1" * 32},
        {"live_permitted": True},
        {"sent": True},
        {"broker": "desk"},
    ):
        with pytest.raises(ProductionAuthorizationError):
            validate_production_authorization_command(document)


def test_production_authorization_does_not_send():
    source = Path(__file__).with_name("production_authorization.py").read_text(encoding="utf-8")
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
        "finance_production_execution",
        "finance_live_boundary",
        "finance_apply_paper_book",
        "live_order",
        "execution_gateway",
        "live_permitted",
    ):
        assert name not in source

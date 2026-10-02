"""A canonical production authorization for one execution identity. It does not send."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta


class ProductionAuthorizationError(ValueError):
    pass


EXPIRES_IN = "PT15M"
AUTHORIZATION_TTL = timedelta(minutes=15)


def validate_production_authorization_command(document: object) -> dict:
    if not isinstance(document, dict) or len(document) != 0:
        raise ProductionAuthorizationError("production authorization is invalid")
    return {}


def canonical_production_authorization(
    execution_identity: str,
    intent_digest: str,
    evaluation_digest: str,
    policy_digest: str,
    authorization_digest: str,
) -> dict:
    return {
        "authorization_digest": authorization_digest,
        "evaluation_digest": evaluation_digest,
        "execution_identity": execution_identity,
        "expires_in": EXPIRES_IN,
        "intent_digest": intent_digest,
        "policy_digest": policy_digest,
    }


def production_authorization_digest(authorization: dict) -> str:
    payload = json.dumps(authorization, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.md5(payload.encode("utf-8")).hexdigest()


def match_production_authorization(stored: dict, current: dict, now: datetime) -> dict:
    if stored.get("lifecycle") == "cancelled" or stored.get("reason") == "cancelled":
        raise ProductionAuthorizationError("production authorization cancelled")
    if stored.get("lifecycle") != "recorded" or stored.get("reason") is not None:
        raise ProductionAuthorizationError("production authorization does not match")
    if now >= stored["expires_at"]:
        raise ProductionAuthorizationError("production authorization expired")
    for key in (
        "execution_identity",
        "intent_digest",
        "evaluation_digest",
        "policy_digest",
        "authorization_digest",
    ):
        if stored[key] != current[key]:
            raise ProductionAuthorizationError("production authorization does not match")
    expected = production_authorization_digest(
        canonical_production_authorization(
            stored["execution_identity"],
            stored["intent_digest"],
            stored["evaluation_digest"],
            stored["policy_digest"],
            stored["authorization_digest"],
        )
    )
    if stored["production_authorization_digest"] != expected:
        raise ProductionAuthorizationError("production authorization does not match")
    return stored


def cancel_production_authorization(stored: dict) -> dict:
    if stored.get("lifecycle") == "cancelled" and stored.get("reason") == "cancelled":
        return stored
    if stored.get("lifecycle") != "recorded" or stored.get("reason") is not None:
        raise ProductionAuthorizationError("production authorization does not match")
    cancelled = dict(stored)
    cancelled["lifecycle"] = "cancelled"
    cancelled["reason"] = "cancelled"
    return cancelled

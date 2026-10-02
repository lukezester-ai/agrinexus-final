"""A human authorization of one order intent. It does not send an order."""

from __future__ import annotations

import hashlib
import json


class OrderAuthorizationError(ValueError):
    pass


def validate_authorization_command(document: object) -> dict:
    if not isinstance(document, dict) or len(document) != 0:
        raise OrderAuthorizationError("order authorization is invalid")
    return {}


def canonical_order_authorization(intent_id: str, intent_digest: str, evaluation_digest: str) -> dict:
    return {
        "intent_id": intent_id,
        "intent_digest": intent_digest,
        "evaluation_digest": evaluation_digest,
    }


def authorization_digest(authorization: dict) -> str:
    payload = json.dumps(authorization, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.md5(payload.encode("utf-8")).hexdigest()

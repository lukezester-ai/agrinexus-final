"""The protected exit for one human authorization. It does not send an order."""

from __future__ import annotations

import hashlib
import json


class GatewayBoundaryError(ValueError):
    pass


def validate_gateway_command(document: object) -> dict:
    if not isinstance(document, dict) or len(document) != 0:
        raise GatewayBoundaryError("gateway boundary is invalid")
    return {}


def canonical_gateway_boundary(
    authorization_id: str,
    authorization_digest: str,
    intent_digest: str,
    evaluation_digest: str,
) -> dict:
    return {
        "authorization_id": authorization_id,
        "authorization_digest": authorization_digest,
        "intent_digest": intent_digest,
        "evaluation_digest": evaluation_digest,
    }


def gateway_digest(boundary: dict) -> str:
    payload = json.dumps(boundary, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.md5(payload.encode("utf-8")).hexdigest()

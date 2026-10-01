"""Production result integrity. An unobserved dispatch does not send."""

from __future__ import annotations

import hashlib
import json


class ProductionResultError(ValueError):
    pass


NAMED_OBSERVATIONS = frozenset({"accepted", "rejected", "filled", "partial", "unknown"})


def validate_result_command(document: object) -> dict:
    if not isinstance(document, dict) or len(document) != 0:
        raise ProductionResultError("production dispatch is invalid")
    return {}


def classify_observation(observation: object) -> str:
    if observation in NAMED_OBSERVATIONS:
        return str(observation)
    return "unknown"


def outcome_class(result: str) -> str:
    if result == "filled":
        return "success"
    if result == "rejected":
        return "rejected"
    return "unknown"


def result_is_success(result: str) -> bool:
    return outcome_class(result) == "success"


def payload_digest(
    execution_identity: str,
    instrument: str,
    side: str,
    quantity: str,
    authorization_digest: str,
    contract_digest: str,
) -> str:
    payload = {
        "authorization_digest": authorization_digest,
        "contract_digest": contract_digest,
        "execution_identity": execution_identity,
        "instrument": instrument,
        "quantity": quantity,
        "side": side,
    }
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.md5(encoded.encode("utf-8")).hexdigest()


def recheck_production_limit(quantity, exposure, order_limit=1, exposure_limit=10000):
    if quantity > order_limit or exposure > exposure_limit:
        raise ProductionResultError("production limit re-check denied")


def record_dispatch(execution_identity: str, kill_switch: bool, existing: dict | None = None) -> dict:
    if kill_switch:
        raise ProductionResultError("production kill switch is engaged")
    if existing is not None:
        if existing.get("execution_identity") != execution_identity:
            raise ProductionResultError("production dispatch does not match")
        return existing
    return {
        "execution_identity": execution_identity,
        "admitted": False,
        "sent": False,
        "live_permitted": False,
    }


def record_external_result(
    execution_identity: str,
    existing: dict | None = None,
    kill_switch: bool = False,
) -> dict:
    if existing is not None:
        if existing.get("execution_identity") != execution_identity or existing.get("external_result") != "unobserved":
            raise ProductionResultError("production result does not match")
        return existing
    if kill_switch:
        raise ProductionResultError("production kill switch is engaged")
    return {
        "execution_identity": execution_identity,
        "external_result": "unobserved",
        "outcome_class": "unknown",
        "success": False,
    }


def reconcile_result(
    stored: dict,
    current: dict,
    existing: dict | None = None,
    kill_switch: bool = False,
) -> dict:
    for key in (
        "execution_identity",
        "instrument",
        "side",
        "quantity",
        "authorization_digest",
        "contract_digest",
        "payload_digest",
    ):
        if stored[key] != current[key]:
            raise ProductionResultError("production result does not match")
    if stored["external_result"] != "unobserved" or result_is_success(stored["external_result"]):
        raise ProductionResultError("production result does not match")
    if existing is not None:
        if existing.get("execution_identity") != stored["execution_identity"]:
            raise ProductionResultError("production result does not match")
        return existing
    if kill_switch:
        raise ProductionResultError("production kill switch is engaged")
    return {
        "execution_identity": stored["execution_identity"],
        "comparison": "unresolved",
        "outcome_class": "unknown",
        "success": False,
    }

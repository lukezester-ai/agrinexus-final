"""Production safety controls for one authorization. They do not send."""

from __future__ import annotations


class ProductionSafetyError(ValueError):
    pass


ORDER_LIMIT = 1
EXPOSURE_LIMIT = 10000
MAX_RETRIES = 0
TIMEOUT_IS_SUCCESS = False
ALLOWED_TARGETS = ()


def validate_safety_command(document: object) -> dict:
    if not isinstance(document, dict) or len(document) != 0:
        raise ProductionSafetyError("production safety is invalid")
    return {}


def target_allowed(target: str) -> bool:
    return target in ALLOWED_TARGETS


def pass_production_safety(
    execution_identity: str,
    quantity: int,
    exposure: int,
    kill_switch: bool,
    existing: dict | None = None,
) -> dict:
    if kill_switch:
        raise ProductionSafetyError("production kill switch is engaged")
    if quantity > ORDER_LIMIT or exposure > EXPOSURE_LIMIT:
        raise ProductionSafetyError("production safety limit exceeded")
    if not TIMEOUT_IS_SUCCESS and MAX_RETRIES != 0:
        raise ProductionSafetyError("production safety is invalid")
    if existing is not None:
        if existing.get("execution_identity") != execution_identity or existing.get("decision") != "held":
            raise ProductionSafetyError("production safety does not match")
        return existing
    return {
        "execution_identity": execution_identity,
        "decision": "held",
        "admitted": False,
        "order_limit": ORDER_LIMIT,
        "exposure_limit": EXPOSURE_LIMIT,
        "allowed_targets": [],
        "material_withheld": True,
        "timeout_is_success": TIMEOUT_IS_SUCCESS,
        "max_retries": MAX_RETRIES,
        "switch_clear": True,
    }

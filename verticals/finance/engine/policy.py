"""A risk policy is a canonical document. It does not evaluate a strategy."""

from __future__ import annotations

import hashlib
import json
import math

POLICY_FIELDS = (
    "allowed_instruments",
    "allowed_strategies",
    "forbidden_actions",
    "max_concurrent_positions",
    "max_drawdown",
    "max_exposure",
    "max_risk_per_position",
)
LIST_FIELDS = ("allowed_instruments", "allowed_strategies", "forbidden_actions")
NUMBER_FIELDS = ("max_drawdown", "max_exposure", "max_risk_per_position")
REFUSED_VALUES = frozenset({"broker", "live"})


class RiskPolicyError(ValueError):
    pass


def validate_risk_policy(document: object) -> dict:
    if not isinstance(document, dict) or set(document) != set(POLICY_FIELDS):
        raise RiskPolicyError("risk policy is invalid")
    canonical = {
        "max_concurrent_positions": _number(document["max_concurrent_positions"], integer=True),
        "max_drawdown": _number(document["max_drawdown"], integer=False),
        "max_exposure": _number(document["max_exposure"], integer=False),
        "max_risk_per_position": _number(document["max_risk_per_position"], integer=False),
    }
    for field in LIST_FIELDS:
        canonical[field] = _strings(document[field])
    return canonical


def policy_digest(policy: dict) -> str:
    payload = json.dumps(policy, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.md5(payload.encode("utf-8")).hexdigest()


def _number(value: object, integer: bool) -> int | float:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise RiskPolicyError("risk policy is invalid")
    if value < 0:
        raise RiskPolicyError("risk policy is invalid")
    if integer and not float(value).is_integer():
        raise RiskPolicyError("risk policy is invalid")
    if float(value).is_integer():
        return int(value)
    return float(value)


def _strings(value: object) -> list[str]:
    if not isinstance(value, list):
        raise RiskPolicyError("risk policy is invalid")
    items: list[str] = []
    for item in value:
        if not isinstance(item, str) or item == "" or item != item.strip() or item in REFUSED_VALUES:
            raise RiskPolicyError("risk policy is invalid")
        items.append(item)
    if len(items) != len(set(items)):
        raise RiskPolicyError("risk policy is invalid")
    return sorted(items)

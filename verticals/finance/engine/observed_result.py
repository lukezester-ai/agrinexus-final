"""An observed production result. It does not send."""

from __future__ import annotations


class ObservedResultError(ValueError):
    pass


NAMED = frozenset({"accepted", "rejected", "filled", "partial", "unknown"})
UNRESOLVED = frozenset({"timeout", "missing", "invalid"})


def validate_observed_command(document: object) -> dict:
    if not isinstance(document, dict) or len(document) != 0:
        raise ObservedResultError("production observed result is invalid")
    return {}


def classify_observed_result(observation: str) -> str:
    if observation in NAMED:
        return observation
    if observation in UNRESOLVED:
        return "unknown"
    raise ObservedResultError("production observed result is invalid")


def outcome_class(result: str) -> str:
    if result == "filled":
        return "success"
    if result == "rejected":
        return "rejected"
    return "unknown"


def record_observed_result(execution_identity: str, observation: str, existing: dict | None = None) -> dict:
    classified = classify_observed_result(observation)
    if existing is not None:
        if existing.get("execution_identity") != execution_identity or existing.get("external_result") != classified:
            raise ObservedResultError("production result does not match")
        return existing
    return {
        "execution_identity": execution_identity,
        "external_result": classified,
        "outcome_class": outcome_class(classified),
        "success": classified == "filled",
        "admitted": False,
        "sent": False,
        "live_permitted": False,
    }


def reconcile_observed_result(stored: dict, current: dict) -> dict:
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
            raise ObservedResultError("production result does not match")
    if stored["external_result"] == "unknown" and stored["success"]:
        raise ObservedResultError("production result does not match")
    if stored["external_result"] == "filled":
        comparison = "matched"
    elif stored["external_result"] == "rejected":
        comparison = "terminal"
    else:
        comparison = "unresolved"
    return {
        "execution_identity": stored["execution_identity"],
        "comparison": comparison,
        "outcome_class": outcome_class(stored["external_result"]),
        "success": stored["external_result"] == "filled",
        "sent": False,
        "live_permitted": False,
    }

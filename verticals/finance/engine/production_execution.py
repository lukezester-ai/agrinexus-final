"""Record that a blocked live boundary refuses production. It does not send."""

from __future__ import annotations


class ProductionExecutionError(ValueError):
    pass


def validate_production_command(document: object) -> dict:
    if not isinstance(document, dict) or len(document) != 0:
        raise ProductionExecutionError("production execution is invalid")
    return {}


def refuse_observation(outcome: str) -> dict:
    if outcome in ("accepted", "acknowledged", "rejected", "timeout", "unknown"):
        return {"observed_outcome": outcome, "decision": "refused", "sent": False}
    raise ProductionExecutionError("production execution is invalid")

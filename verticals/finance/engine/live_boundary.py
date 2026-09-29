"""Record that a reconciled sandbox outcome stays inside. It does not send."""

from __future__ import annotations


class LiveBoundaryError(ValueError):
    pass


def validate_live_boundary_command(document: object) -> dict:
    if not isinstance(document, dict) or len(document) != 0:
        raise LiveBoundaryError("live boundary is invalid")
    return {}


def bound_observation(outcome: str) -> dict:
    if outcome in ("accepted", "acknowledged", "rejected", "timeout", "unknown"):
        return {"observed_outcome": outcome, "decision": "blocked", "live_permitted": False}
    raise LiveBoundaryError("live boundary is invalid")

"""Compare one stored sandbox outcome with its execution contract. It does not send."""

from __future__ import annotations


class SandboxReconciliationError(ValueError):
    pass


def validate_reconciliation_command(document: object) -> dict:
    if not isinstance(document, dict) or len(document) != 0:
        raise SandboxReconciliationError("sandbox reconciliation is invalid")
    return {}


def reconcile_observation(outcome: str) -> dict:
    if outcome in ("accepted", "acknowledged"):
        return {
            "observed_outcome": outcome,
            "comparison": "pending",
            "result_known": False,
        }
    if outcome == "rejected":
        return {
            "observed_outcome": outcome,
            "comparison": "terminal",
            "result_known": True,
        }
    if outcome in ("timeout", "unknown"):
        return {
            "observed_outcome": outcome,
            "comparison": "unresolved",
            "result_known": False,
        }
    raise SandboxReconciliationError("sandbox reconciliation is invalid")

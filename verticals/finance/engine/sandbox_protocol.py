"""Sandbox protocol states for one execution contract. It does not send."""

from __future__ import annotations


class SandboxProtocolError(ValueError):
    pass


EVENTS = frozenset({"open", "acknowledge", "reject", "timeout", "reconcile"})


def validate_protocol_command(event: object, document: object) -> dict:
    if event not in EVENTS or not isinstance(document, dict) or len(document) != 0:
        raise SandboxProtocolError("sandbox protocol is invalid")
    return {}


def open_protocol() -> dict:
    return {
        "status": "accepted",
        "result_status": "pending",
        "result_known": False,
        "reconciliation_required": False,
        "comparison": None,
    }


def apply_protocol(state: dict | None, event: str) -> dict:
    if event not in EVENTS:
        raise SandboxProtocolError("sandbox protocol is invalid")
    if state is None:
        if event != "open":
            raise SandboxProtocolError("sandbox protocol not found")
        return open_protocol()
    if event == "open":
        return dict(state)
    status = state["status"]
    if status == "rejected":
        if event == "reject":
            return dict(state)
        raise SandboxProtocolError("sandbox protocol is rejected")
    if status == "timeout":
        if event == "timeout":
            return dict(state)
        if event == "reconcile":
            recorded = dict(state)
            recorded["comparison"] = "unobserved"
            return recorded
        raise SandboxProtocolError("sandbox protocol is unknown")
    if event == "acknowledge":
        if status == "acknowledged":
            return dict(state)
        if status != "accepted":
            raise SandboxProtocolError("sandbox protocol is invalid")
        recorded = dict(state)
        recorded["status"] = "acknowledged"
        return recorded
    if event == "reject":
        if status not in ("accepted", "acknowledged"):
            raise SandboxProtocolError("sandbox protocol is invalid")
        return {
            "status": "rejected",
            "result_status": "rejected",
            "result_known": True,
            "reconciliation_required": False,
            "comparison": None,
        }
    if event == "timeout":
        if status not in ("accepted", "acknowledged"):
            raise SandboxProtocolError("sandbox protocol is invalid")
        return {
            "status": "timeout",
            "result_status": "unknown",
            "result_known": False,
            "reconciliation_required": True,
            "comparison": None,
        }
    raise SandboxProtocolError("sandbox reconciliation is not required")

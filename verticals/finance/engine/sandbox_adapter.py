"""Send one sandbox protocol to the configured sandbox. Production is unreachable."""

from __future__ import annotations

import json
import urllib.error
import urllib.request


class SandboxAdapterError(ValueError):
    pass


SANDBOX_ENDPOINT = "http://127.0.0.1:54345/sandbox"
OBSERVED = frozenset({"accepted", "acknowledged", "rejected", "timeout", "unknown"})


def validate_adapter_command(document: object) -> dict:
    if not isinstance(document, dict) or len(document) != 0:
        raise SandboxAdapterError("sandbox adapter is invalid")
    return {}


def endpoint_allowed(url: str) -> bool:
    return url == SANDBOX_ENDPOINT


def interpret_sandbox_response(raw: bytes) -> str:
    try:
        parsed = json.loads(raw.decode("utf-8"))
    except (UnicodeError, json.JSONDecodeError):
        return "unknown"
    status = parsed.get("status") if isinstance(parsed, dict) else None
    if status in OBSERVED:
        return status
    return "unknown"


def transmit(url: str, payload: dict, opener=urllib.request.urlopen) -> str:
    if not endpoint_allowed(url):
        raise SandboxAdapterError("production endpoint is impossible")
    body = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    request = urllib.request.Request(
        SANDBOX_ENDPOINT,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with opener(request, timeout=0.5) as response:
            observed = interpret_sandbox_response(response.read())
    except TimeoutError:
        return "timeout"
    except urllib.error.URLError as error:
        if isinstance(getattr(error, "reason", None), TimeoutError):
            return "timeout"
        return "unknown"
    return observed


def dispatch_sandbox(cur, contract_id, document: object, opener=urllib.request.urlopen) -> dict:
    validate_adapter_command(document)
    cur.execute(
        "SELECT * FROM public.finance_begin_sandbox_dispatch(%s, %s::jsonb)",
        (contract_id, "{}"),
    )
    row = cur.fetchone()
    dispatch_id, endpoint, execution_identity, expected_contract, send_required, outcome = row
    if endpoint != SANDBOX_ENDPOINT or not endpoint_allowed(endpoint):
        raise SandboxAdapterError("production endpoint is impossible")
    if not send_required:
        return {
            "dispatch_id": dispatch_id,
            "endpoint": SANDBOX_ENDPOINT,
            "execution_identity": execution_identity,
            "outcome": outcome,
            "sent": False,
        }
    payload = {
        "execution_identity": execution_identity,
        "expected_contract": expected_contract,
    }
    try:
        outcome = transmit(SANDBOX_ENDPOINT, payload, opener)
    except SandboxAdapterError:
        raise
    except Exception:
        outcome = "unknown"
    cur.execute(
        "SELECT public.finance_finish_sandbox_dispatch(%s, %s)",
        (contract_id, outcome),
    )
    cur.fetchone()
    return {
        "dispatch_id": dispatch_id,
        "endpoint": SANDBOX_ENDPOINT,
        "execution_identity": execution_identity,
        "outcome": outcome,
        "sent": True,
    }

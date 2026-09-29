"""One execution contract for an admitted authorization. It does not send an order."""

from __future__ import annotations

import hashlib
import json


class ExecutionContractError(ValueError):
    pass


def validate_execution_command(document: object) -> dict:
    if not isinstance(document, dict) or len(document) != 0:
        raise ExecutionContractError("execution contract is invalid")
    return {}


def canonical_execution_contract(
    authorization_id: str,
    authorization_digest: str,
    intent_id: str,
    intent_digest: str,
    evaluation_digest: str,
    instrument: str,
    side: str,
    quantity: str,
) -> dict:
    return {
        "authorization_id": authorization_id,
        "authorization_digest": authorization_digest,
        "intent_id": intent_id,
        "intent_digest": intent_digest,
        "evaluation_digest": evaluation_digest,
        "instrument": instrument,
        "side": side,
        "quantity": quantity,
    }


def execution_identity(contract: dict) -> str:
    payload = json.dumps(contract, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.md5(payload.encode("utf-8")).hexdigest()

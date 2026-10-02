"""Untrusted model output becomes a canonical strategy spec, or it is rejected.

The user text is not parsed into rules. Missing fields are not invented.
This module does not run a backtest, touch a paper book, or place an order.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass

from engine.dsl import validate_spec
from engine.strategy import StrategySpecError

COMMAND_KEYS = frozenset({"action", "broker", "execute", "live", "order", "side"})


@dataclass(frozen=True)
class CanonicalSpecification:
    spec: dict
    digest: str


def compile_model_output(user_text: str, model_output: object) -> CanonicalSpecification:
    candidate = parse_model_candidate(user_text, model_output)
    canonical = validate_spec(candidate)
    return CanonicalSpecification(canonical, specification_digest(canonical))


def parse_model_candidate(user_text: str, model_output: object) -> dict:
    if not isinstance(user_text, str) or user_text.strip() == "":
        raise StrategySpecError("strategy spec is invalid")
    candidate = model_output
    if isinstance(model_output, str):
        try:
            candidate = json.loads(model_output)
        except json.JSONDecodeError as error:
            raise StrategySpecError("strategy spec is invalid") from error
    if not isinstance(candidate, dict) or _command_key(candidate):
        raise StrategySpecError("strategy spec is invalid")
    return candidate


def specification_digest(spec: dict) -> str:
    payload = json.dumps(spec, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.md5(payload.encode("utf-8")).hexdigest()


def _command_key(node: object) -> bool:
    if isinstance(node, dict):
        if COMMAND_KEYS.intersection(node):
            return True
        return any(_command_key(value) for value in node.values())
    if isinstance(node, list):
        return any(_command_key(item) for item in node)
    return False

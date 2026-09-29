"""A compiled specification enters the existing snapshot book.

The snapshot point chooses the cutoff. The existing validator and book do the rest.
This module does not calculate indicators and does not place an order.
"""

from __future__ import annotations

from decimal import Decimal

from domain.snapshots import SnapshotPoint
from engine.book import SpecBook, run_spec_book
from engine.copilot import CanonicalSpecification, compile_model_output, specification_digest
from engine.dsl import validate_spec
from engine.strategy import StrategySpecError


def run_compiled_on_snapshot(
    user_text: str,
    model_output: object,
    closes: list[Decimal],
    point: SnapshotPoint,
) -> tuple[CanonicalSpecification, SpecBook]:
    if not point.included:
        raise ValueError("snapshot candidate is required")
    if point.bar_index < 0 or point.bar_index >= len(closes):
        raise ValueError("snapshot cutoff is invalid")
    compiled = compile_model_output(user_text, model_output)
    checked = validate_spec(compiled.spec)
    if checked != compiled.spec or specification_digest(checked) != compiled.digest:
        raise StrategySpecError("strategy spec is invalid")
    return compiled, run_spec_book(closes[: point.bar_index + 1], checked)

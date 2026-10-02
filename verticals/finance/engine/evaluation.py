"""Compare a stored risk policy to metrics an existing book already recorded."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from decimal import ROUND_DOWN, ROUND_HALF_UP, Decimal

from engine.policy import policy_digest, validate_risk_policy


@dataclass(frozen=True)
class PolicyEvaluation:
    accepted: bool
    denials: tuple[str, ...]
    digest: str


def evaluate_policy(
    policy: dict,
    strategy_name: str,
    symbol: str,
    max_drawdown: Decimal,
    market_value: Decimal,
    position_weight: Decimal,
    ending_quantity: Decimal,
    saw_long: bool,
) -> PolicyEvaluation:
    checked = validate_risk_policy(policy)
    denials: list[str] = []
    if strategy_name not in checked["allowed_strategies"]:
        denials.append("strategy")
    if symbol not in checked["allowed_instruments"]:
        denials.append("instrument")
    if max_drawdown > _limit(checked["max_drawdown"]):
        denials.append("max_drawdown")
    if market_value > _limit(checked["max_exposure"]):
        denials.append("max_exposure")
    if position_weight > _limit(checked["max_risk_per_position"]):
        denials.append("max_risk_per_position")
    open_positions = 1 if ending_quantity > 0 else 0
    if open_positions > checked["max_concurrent_positions"]:
        denials.append("max_concurrent_positions")
    if saw_long and "long" in checked["forbidden_actions"]:
        denials.append("forbidden_action")
    ordered = tuple(sorted(denials))
    accepted = not ordered
    action = "long" if saw_long else ""
    decision = "allow" if accepted else "deny"
    payload = "|".join(
        (
            "E",
            policy_digest(checked),
            strategy_name,
            symbol,
            _money_text(max_drawdown),
            _money_text(market_value),
            _money_text(position_weight),
            str(open_positions),
            action,
            decision,
            ",".join(ordered),
        )
    )
    return PolicyEvaluation(accepted, ordered, hashlib.md5(payload.encode("utf-8")).hexdigest())


def _limit(value: int | float) -> Decimal:
    return Decimal(str(value))


def _money_text(value: Decimal) -> str:
    amount = value.quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)
    sign = "-" if amount < 0 else ""
    absolute = -amount if amount < 0 else amount
    whole = int(absolute.to_integral_value(rounding=ROUND_DOWN))
    fraction = int(((absolute - Decimal(whole)) * Decimal(1000000)).to_integral_value(rounding=ROUND_DOWN))
    return f"{sign}{whole}.{fraction:06d}"

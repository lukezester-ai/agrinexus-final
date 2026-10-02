"""A canonical order intent copied from an approval. It does not send an order."""

from __future__ import annotations

import hashlib
import json
from decimal import ROUND_DOWN, ROUND_HALF_UP, Decimal


class OrderIntentError(ValueError):
    pass


def validate_intent_command(document: object) -> dict:
    if not isinstance(document, dict) or len(document) != 0:
        raise OrderIntentError("order intent is invalid")
    return {}


def canonical_order_intent(
    approval_id: str,
    instrument: str,
    quantity: Decimal,
    specification_digest: str,
    strategy_digest: str,
    backtest_digest: str,
    risk_digest: str,
    evaluation_digest: str,
) -> dict:
    return {
        "approval_id": approval_id,
        "instrument": instrument,
        "side": "long" if quantity > 0 else "",
        "quantity": _quantity_text(quantity),
        "specification_digest": specification_digest,
        "strategy_digest": strategy_digest,
        "backtest_digest": backtest_digest,
        "risk_digest": risk_digest,
        "evaluation_digest": evaluation_digest,
    }


def intent_digest(intent: dict) -> str:
    payload = json.dumps(intent, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.md5(payload.encode("utf-8")).hexdigest()


def _quantity_text(value: Decimal) -> str:
    amount = value.quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)
    sign = "-" if amount < 0 else ""
    absolute = -amount if amount < 0 else amount
    whole = int(absolute.to_integral_value(rounding=ROUND_DOWN))
    fraction = int(((absolute - Decimal(whole)) * Decimal(1000000)).to_integral_value(rounding=ROUND_DOWN))
    return f"{sign}{whole}.{fraction:06d}"

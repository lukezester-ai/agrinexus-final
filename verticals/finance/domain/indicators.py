from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class IndicatorPoint:
    bar_index: int
    sma_fast: Decimal | None
    sma_slow: Decimal | None
    rsi: Decimal | None
    signal: bool

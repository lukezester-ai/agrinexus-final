from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal


@dataclass(frozen=True)
class MarketBar:
    bar_index: int
    close: Decimal
    volume: Decimal


@dataclass(frozen=True)
class OhlcvBar:
    bar_index: int
    bar_time: datetime
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: Decimal

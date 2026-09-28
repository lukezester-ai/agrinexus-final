from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class MarketBar:
    bar_index: int
    close: Decimal
    volume: Decimal

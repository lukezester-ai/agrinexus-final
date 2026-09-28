from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class PaperFill:
    bar_index: int
    side: str
    price: Decimal
    quantity: Decimal
    pnl: Decimal | None

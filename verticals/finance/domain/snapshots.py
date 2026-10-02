from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class SnapshotPoint:
    exchange: str
    symbol: str
    bar_index: int
    price: Decimal
    volume: Decimal
    included: bool
    features: tuple[tuple[str, int, Decimal | None], ...]


@dataclass(frozen=True)
class MarketSnapshot:
    points: tuple[SnapshotPoint, ...]
    digest: str

from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class ScreenerSeries:
    exchange: str
    symbol: str
    closes: tuple[Decimal, ...]
    volumes: tuple[Decimal, ...]


@dataclass(frozen=True)
class ScreenerCandidate:
    exchange: str
    symbol: str
    close: Decimal
    volume: Decimal


@dataclass(frozen=True)
class ScreenerResult:
    candidates: tuple[ScreenerCandidate, ...]
    digest: str

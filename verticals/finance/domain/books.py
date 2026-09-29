from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class LedgerTrade:
    trade_index: int
    entry_bar: int
    exit_bar: int | None
    entry_price: Decimal
    exit_price: Decimal | None
    quantity: Decimal
    pnl: Decimal | None


@dataclass(frozen=True)
class DrawdownPoint:
    bar_index: int
    equity: Decimal
    peak: Decimal
    drawdown: Decimal


@dataclass(frozen=True)
class PerformanceStats:
    trade_count: int
    win_count: int
    loss_count: int
    win_rate: Decimal
    avg_trade: Decimal
    gross_profit: Decimal
    gross_loss: Decimal
    profit_factor: Decimal | None
    closed_pnl: Decimal
    paper_pnl: Decimal
    ending_equity: Decimal
    total_return: Decimal
    max_drawdown: Decimal
    peak_equity: Decimal
    max_drawdown_bars: int


@dataclass(frozen=True)
class PaperAllocation:
    cash: Decimal
    quantity: Decimal
    avg_price: Decimal
    mark_price: Decimal
    market_value: Decimal
    equity: Decimal
    cash_weight: Decimal
    position_weight: Decimal


@dataclass(frozen=True)
class SpecBook:
    ledger: tuple[LedgerTrade, ...]
    drawdown: tuple[DrawdownPoint, ...]
    stats: PerformanceStats
    allocation: PaperAllocation
    digest: str

from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class RiskMetrics:
    trade_count: int
    closed_pnl: Decimal
    paper_pnl: Decimal
    ending_equity: Decimal
    total_return: Decimal
    max_drawdown: Decimal

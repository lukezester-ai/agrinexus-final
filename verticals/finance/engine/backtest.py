from decimal import Decimal

from domain.backtests import PaperFill
from domain.risk import RiskMetrics
from domain.strategies import INITIAL_CASH
from engine.indicators import indicator_frame, quantize
from engine.risk import metrics_from_equity


def run_long_rule(closes: list[Decimal]) -> tuple[list[PaperFill], RiskMetrics]:
    if len(closes) < 50:
        raise ValueError("v1 long rule needs at least 50 closes")
    frame = indicator_frame(closes)
    cash = Decimal(INITIAL_CASH)
    quantity = Decimal("0")
    entry: Decimal | None = None
    fills: list[PaperFill] = []
    equity: list[Decimal] = []
    closed_pnl = Decimal("0")
    trade_count = 0
    for point in frame:
        price = closes[point.bar_index]
        if quantity == 0 and point.signal:
            quantity = Decimal("1")
            cash -= price
            entry = price
            fills.append(PaperFill(point.bar_index, "buy", price, Decimal("1"), None))
        elif quantity == 1 and not point.signal:
            if entry is None:
                raise ValueError("open long has no entry")
            pnl = price - entry
            cash += price
            quantity = Decimal("0")
            closed_pnl += pnl
            trade_count += 1
            fills.append(PaperFill(point.bar_index, "sell", price, Decimal("1"), quantize(pnl)))
            entry = None
        equity.append(cash + quantity * price)
    unrealized = Decimal("0")
    if quantity == 1 and entry is not None:
        unrealized = closes[-1] - entry
    paper_pnl = closed_pnl + unrealized
    return fills, metrics_from_equity(Decimal(INITIAL_CASH), equity, closed_pnl, paper_pnl, trade_count)

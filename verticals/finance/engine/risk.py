from decimal import Decimal

from domain.risk import RiskMetrics
from engine.indicators import quantize


def metrics_from_equity(
    starting_cash: Decimal,
    equity: list[Decimal],
    closed_pnl: Decimal,
    paper_pnl: Decimal,
    trade_count: int,
) -> RiskMetrics:
    if not equity:
        raise ValueError("equity curve is empty")
    peak = equity[0]
    max_drawdown = Decimal("0")
    for point in equity:
        if point > peak:
            peak = point
        if peak > 0:
            drawdown = (peak - point) / peak
            if drawdown > max_drawdown:
                max_drawdown = drawdown
    ending = equity[-1]
    total_return = (ending - starting_cash) / starting_cash
    return RiskMetrics(
        trade_count=trade_count,
        closed_pnl=quantize(closed_pnl),
        paper_pnl=quantize(paper_pnl),
        ending_equity=quantize(ending),
        total_return=quantize(total_return),
        max_drawdown=quantize(max_drawdown),
    )

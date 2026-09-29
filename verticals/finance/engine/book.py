import hashlib
from decimal import Decimal

from domain.books import DrawdownPoint, LedgerTrade, PaperAllocation, PerformanceStats, SpecBook
from domain.strategies import INITIAL_CASH
from engine.dsl import execute_spec
from engine.indicators import quantize
from engine.risk import metrics_from_equity


def run_spec_book(closes: list[Decimal], spec: dict) -> SpecBook:
    signals = execute_spec(closes, spec)
    if not closes or len(signals) != len(closes):
        raise ValueError("spec book needs one signal per close")
    cash = Decimal(INITIAL_CASH)
    quantity = Decimal("0")
    entry_price: Decimal | None = None
    entry_bar: int | None = None
    previous = 0
    ledger: list[LedgerTrade] = []
    equity: list[Decimal] = []
    closed_pnl = Decimal("0")
    gross_profit = Decimal("0")
    gross_loss = Decimal("0")
    wins = 0
    losses = 0
    trade_index = 0
    for signal, price in zip(signals, closes):
        if previous == 0 and signal.position == 1:
            quantity = Decimal("1")
            cash -= price
            entry_price = price
            entry_bar = signal.bar_index
        elif previous == 1 and signal.position == 0:
            if entry_price is None or entry_bar is None:
                raise ValueError("open long has no entry")
            raw_pnl = price - entry_price
            ledger.append(
                LedgerTrade(
                    trade_index,
                    entry_bar,
                    signal.bar_index,
                    quantize(entry_price),
                    quantize(price),
                    quantize(Decimal("1")),
                    quantize(raw_pnl),
                )
            )
            trade_index += 1
            cash += price
            closed_pnl += raw_pnl
            if raw_pnl > 0:
                wins += 1
                gross_profit += raw_pnl
            elif raw_pnl < 0:
                losses += 1
                gross_loss += -raw_pnl
            quantity = Decimal("0")
            entry_price = None
            entry_bar = None
        elif signal.position not in (0, 1):
            raise ValueError("spec position is invalid")
        previous = signal.position
        equity.append(cash + quantity * price)
    unrealized = Decimal("0")
    if quantity == 1:
        if entry_price is None or entry_bar is None:
            raise ValueError("open long has no entry")
        unrealized = closes[-1] - entry_price
        ledger.append(
            LedgerTrade(
                trade_index,
                entry_bar,
                None,
                quantize(entry_price),
                None,
                quantize(Decimal("1")),
                None,
            )
        )
    trade_count = sum(1 for trade in ledger if trade.pnl is not None)
    metrics = metrics_from_equity(
        Decimal(INITIAL_CASH),
        equity,
        closed_pnl,
        closed_pnl + unrealized,
        trade_count,
    )
    drawdown, peak_equity, max_drawdown_bars = _drawdown(equity)
    if trade_count:
        win_rate = quantize(Decimal(wins) / Decimal(trade_count))
        avg_trade = quantize(closed_pnl / Decimal(trade_count))
    else:
        win_rate = quantize(Decimal("0"))
        avg_trade = quantize(Decimal("0"))
    profit_factor = quantize(gross_profit / gross_loss) if gross_loss > 0 else None
    stats = PerformanceStats(
        trade_count=trade_count,
        win_count=wins,
        loss_count=losses,
        win_rate=win_rate,
        avg_trade=avg_trade,
        gross_profit=quantize(gross_profit),
        gross_loss=quantize(gross_loss),
        profit_factor=profit_factor,
        closed_pnl=metrics.closed_pnl,
        paper_pnl=metrics.paper_pnl,
        ending_equity=metrics.ending_equity,
        total_return=metrics.total_return,
        max_drawdown=metrics.max_drawdown,
        peak_equity=peak_equity,
        max_drawdown_bars=max_drawdown_bars,
    )
    ending = equity[-1]
    if ending == 0:
        raise ValueError("paper equity is zero")
    mark = closes[-1]
    market_value = quantity * mark
    allocation = PaperAllocation(
        cash=quantize(cash),
        quantity=quantize(quantity),
        avg_price=quantize(entry_price) if entry_price is not None else quantize(Decimal("0")),
        mark_price=quantize(mark),
        market_value=quantize(market_value),
        equity=metrics.ending_equity,
        cash_weight=quantize(cash / ending),
        position_weight=quantize(market_value / ending),
    )
    book = SpecBook(tuple(ledger), tuple(drawdown), stats, allocation, "")
    return SpecBook(book.ledger, book.drawdown, book.stats, book.allocation, book_digest(book))


def book_digest(book: SpecBook) -> str:
    lines: list[str] = []
    for trade in book.ledger:
        exit_bar = "" if trade.exit_bar is None else str(trade.exit_bar)
        lines.append(
            "L|{index}|{entry}|{exit}|{entry_price}|{exit_price}|{quantity}|{pnl}".format(
                index=trade.trade_index,
                entry=trade.entry_bar,
                exit=exit_bar,
                entry_price=_money(trade.entry_price),
                exit_price=_money(trade.exit_price),
                quantity=_money(trade.quantity),
                pnl=_money(trade.pnl),
            )
        )
    stats = book.stats
    lines.append(
        "S|{trades}|{wins}|{losses}|{win_rate}|{avg}|{gross_profit}|{gross_loss}|{factor}|{closed}|{paper}|{ending}|{ret}|{dd}|{peak}|{bars}".format(
            trades=stats.trade_count,
            wins=stats.win_count,
            losses=stats.loss_count,
            win_rate=_money(stats.win_rate),
            avg=_money(stats.avg_trade),
            gross_profit=_money(stats.gross_profit),
            gross_loss=_money(stats.gross_loss),
            factor=_money(stats.profit_factor),
            closed=_money(stats.closed_pnl),
            paper=_money(stats.paper_pnl),
            ending=_money(stats.ending_equity),
            ret=_money(stats.total_return),
            dd=_money(stats.max_drawdown),
            peak=_money(stats.peak_equity),
            bars=stats.max_drawdown_bars,
        )
    )
    for point in book.drawdown:
        lines.append(
            "D|{bar}|{equity}|{peak}|{drawdown}".format(
                bar=point.bar_index,
                equity=_money(point.equity),
                peak=_money(point.peak),
                drawdown=_money(point.drawdown),
            )
        )
    return hashlib.md5("\n".join(lines).encode("utf-8")).hexdigest()


def _money(value: Decimal | None) -> str:
    if value is None:
        return ""
    return format(value, "f")


def _drawdown(equity: list[Decimal]) -> tuple[list[DrawdownPoint], Decimal, int]:
    peak = equity[0]
    peak_index = 0
    max_drawdown = Decimal("0")
    max_drawdown_bars = 0
    points: list[DrawdownPoint] = []
    for index, point in enumerate(equity):
        if point > peak:
            peak = point
            peak_index = index
        drawdown = (peak - point) / peak if peak > 0 else Decimal("0")
        if drawdown > max_drawdown:
            max_drawdown = drawdown
            max_drawdown_bars = index - peak_index
        points.append(DrawdownPoint(index, quantize(point), quantize(peak), quantize(drawdown)))
    return points, quantize(peak), max_drawdown_bars

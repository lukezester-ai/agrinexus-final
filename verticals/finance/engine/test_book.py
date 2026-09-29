from decimal import Decimal

from domain.strategies import V2_LONG_RULE
from engine.backtest import run_long_rule
from engine.book import book_digest, run_spec_book
from engine.fixture import fixture_closes


ALWAYS_LONG = {
    "version": 2,
    "entry": {"all": [{"op": "gt", "left": {"close": True}, "right": {"value": 0}}]},
    "exit": {"all": [{"op": "lt", "left": {"close": True}, "right": {"value": 0}}]},
}

LOSS_RULE = {
    "version": 2,
    "entry": {"all": [{"op": "gt", "left": {"close": True}, "right": {"value": 128}}]},
    "exit": {"all": [{"op": "lt", "left": {"close": True}, "right": {"value": 121}}]},
}


def test_v2_book_matches_v1_backtest_and_repeats():
    closes = fixture_closes()
    book = run_spec_book(closes, V2_LONG_RULE)
    again = run_spec_book(closes, V2_LONG_RULE)
    fills, metrics = run_long_rule(closes)
    assert book == again
    assert book.digest == book_digest(book)
    assert [(trade.entry_bar, trade.exit_bar, trade.entry_price, trade.exit_price, trade.pnl) for trade in book.ledger] == [
        (fills[0].bar_index, fills[1].bar_index, fills[0].price, fills[1].price, fills[1].pnl)
    ]
    assert book.stats.trade_count == metrics.trade_count == 1
    assert book.stats.win_count == 1
    assert book.stats.loss_count == 0
    assert book.stats.win_rate == Decimal("1.000000")
    assert book.stats.avg_trade == Decimal("1.300000")
    assert book.stats.gross_profit == Decimal("1.300000")
    assert book.stats.gross_loss == Decimal("0.000000")
    assert book.stats.profit_factor is None
    assert book.stats.closed_pnl == metrics.closed_pnl
    assert book.stats.paper_pnl == metrics.paper_pnl
    assert book.stats.ending_equity == metrics.ending_equity
    assert book.stats.total_return == metrics.total_return
    assert book.stats.max_drawdown == metrics.max_drawdown
    assert book.stats.peak_equity == Decimal("100001.300000")
    assert book.stats.max_drawdown_bars == 51
    assert len(book.drawdown) == len(closes)
    assert max(point.drawdown for point in book.drawdown) == metrics.max_drawdown
    assert book.allocation.quantity == Decimal("0.000000")
    assert book.allocation.cash == metrics.ending_equity
    assert book.allocation.position_weight == Decimal("0.000000")
    assert book.allocation.cash_weight == Decimal("1.000000")


def test_open_position_and_losing_trade_allocate_paper():
    closes = fixture_closes()
    opened = run_spec_book(closes, ALWAYS_LONG)
    assert opened.stats.trade_count == 0
    assert opened.stats.profit_factor is None
    assert opened.ledger[0].exit_bar is None
    assert opened.allocation.quantity == Decimal("1.000000")
    assert opened.allocation.avg_price == closes[0]
    assert opened.allocation.mark_price == closes[-1]
    assert opened.allocation.market_value == closes[-1]
    assert opened.allocation.cash_weight + opened.allocation.position_weight == Decimal("1.000000")
    lost = run_spec_book(closes, LOSS_RULE)
    assert lost.stats.trade_count == 1
    assert lost.stats.win_count == 0
    assert lost.stats.loss_count == 1
    assert lost.stats.profit_factor == Decimal("0.000000")
    assert lost.stats.closed_pnl < 0
    assert lost.allocation.quantity == Decimal("0.000000")
    assert lost == run_spec_book(closes, LOSS_RULE)

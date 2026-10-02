from decimal import Decimal

import pytest

from engine.backtest import run_long_rule
from engine.fixture import fixture_closes
from engine.strategy import StrategySpecError, require_v1_long_rule
from domain.strategies import V1_LONG_RULE


def test_v1_rule_is_the_only_accepted_spec():
    require_v1_long_rule(V1_LONG_RULE)
    with pytest.raises(StrategySpecError):
        require_v1_long_rule({"version": 1, "entry": "long", "broker": "live"})


def test_fixture_backtest_is_deterministic():
    fills, metrics = run_long_rule(fixture_closes())
    assert [(fill.bar_index, fill.side, fill.price, fill.pnl) for fill in fills] == [
        (49, "buy", Decimal("121.10"), None),
        (63, "sell", Decimal("122.40"), Decimal("1.300000")),
    ]
    assert metrics.trade_count == 1
    assert metrics.closed_pnl == Decimal("1.300000")
    assert metrics.paper_pnl == Decimal("1.300000")
    assert metrics.ending_equity == Decimal("100001.300000")
    assert metrics.total_return == Decimal("0.000013")
    assert metrics.max_drawdown == Decimal("0.000011")

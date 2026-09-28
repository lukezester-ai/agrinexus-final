from decimal import Decimal

import pytest

from domain.strategies import V2_LONG_RULE
from engine.backtest import run_long_rule
from engine.dsl import SpecSignal, execute_spec, validate_spec
from engine.fixture import fixture_closes
from engine.indicators import ema
from engine.strategy import StrategySpecError


def test_v2_long_rule_matches_v1_execution():
    closes = fixture_closes()
    signals = execute_spec(closes, V2_LONG_RULE)
    _, _metrics = run_long_rule(closes)
    changes = []
    previous = 0
    for signal in signals:
        if signal.position != previous:
            changes.append((signal.bar_index, "buy" if signal.position == 1 else "sell", closes[signal.bar_index]))
            previous = signal.position
    fills, _metrics = run_long_rule(closes)
    assert changes == [(fill.bar_index, fill.side, fill.price) for fill in fills]
    assert signals[49] == SpecSignal(49, True, False, 1)


def test_ema_or_rule_and_parameter_rejection():
    closes = [Decimal(str(value)) for value in (1, 2, 3, 4, 5)]
    assert ema(closes, 3) == [None, None, Decimal("2.000000"), Decimal("3.000000"), Decimal("4.000000")]
    spec = {
        "version": 2,
        "entry": {
            "any": [
                {"op": "gt", "left": {"ema": 3}, "right": {"value": 3}},
                {"op": "gt", "left": {"close": True}, "right": {"value": 100}},
            ]
        },
        "exit": {"all": [{"op": "lt", "left": {"ema": 3}, "right": {"sma": 3}}]},
    }
    validate_spec(spec)
    signals = execute_spec(closes, spec)
    assert [signal.position for signal in signals] == [0, 0, 0, 0, 1]
    with pytest.raises(StrategySpecError):
        validate_spec({"version": 2, "entry": {"all": []}, "exit": {"all": []}, "broker": "live"})
    with pytest.raises(StrategySpecError):
        validate_spec(
            {
                "version": 2,
                "entry": {"all": [{"op": "gt", "left": {"sma": 1}, "right": {"value": 1}}]},
                "exit": {"all": [{"op": "lt", "left": {"sma": 2}, "right": {"value": 1}}]},
            }
        )

from decimal import Decimal

import pytest

from engine.fixture import fixture_closes
from engine.screener import ScreenerSpecError, screen, validate_screener
from domain.screeners import ScreenerSeries

PRICE_RULE = {
    "version": 1,
    "where": {
        "all": [
            {"op": "gt", "left": {"close": True}, "right": {"value": 100}},
            {"op": "gte", "left": {"volume": True}, "right": {"value": 1000}},
            {"op": "gt", "left": {"momentum": 1}, "right": {"value": 0}},
            {"op": "gt", "left": {"volatility": 5}, "right": {"value": 0}},
            {"op": "gt", "left": {"sma": 20}, "right": {"value": 0}},
            {"op": "gt", "left": {"ema": 10}, "right": {"value": 0}},
            {"op": "gt", "left": {"rsi": 14}, "right": {"value": 0}},
        ]
    },
}


def _series(symbol: str, closes: list[Decimal], volume: str) -> ScreenerSeries:
    return ScreenerSeries("NONE", symbol, tuple(closes), tuple(Decimal(volume) for _ in closes))


def test_screener_candidate_set_is_deterministic():
    closes = fixture_closes()
    flat = [Decimal("50")] * len(closes)
    universe = [
        _series("BETA", flat, "10"),
        _series("ACME", closes, "1000"),
    ]
    first = screen(universe, PRICE_RULE)
    second = screen(list(reversed(universe)), PRICE_RULE)
    assert first == second
    assert [item.symbol for item in first.candidates] == ["ACME"]
    assert first.candidates[0].close == Decimal("123.600000")
    assert first.candidates[0].volume == Decimal("1000.000000")
    assert screen([], PRICE_RULE).digest == "d41d8cd98f00b204e9800998ecf8427e"


def test_momentum_volatility_and_rejected_specs():
    closes = [Decimal(value) for value in ("1", "2", "4", "4")]
    volumes = [Decimal("1")] * len(closes)
    series = ScreenerSeries("NONE", "TINY", tuple(closes), tuple(volumes))
    rule = {
        "version": 1,
        "where": {
            "all": [
                {"op": "gte", "left": {"momentum": 2}, "right": {"value": 2}},
                {"op": "lte", "left": {"momentum": 2}, "right": {"value": 2}},
                {"op": "gte", "left": {"volatility": 3}, "right": {"value": 0.5}},
                {"op": "lte", "left": {"volatility": 3}, "right": {"value": 0.5}},
            ]
        },
    }
    assert [item.symbol for item in screen([series], rule).candidates] == ["TINY"]
    short = {
        "version": 1,
        "where": {"all": [{"op": "gt", "left": {"rsi": 14}, "right": {"value": 0}}]},
    }
    assert screen([series], short).candidates == ()
    with pytest.raises(ScreenerSpecError):
        validate_screener({"version": 1, "where": {"all": []}, "broker": "live"})
    with pytest.raises(ScreenerSpecError):
        validate_screener(
            {
                "version": 1,
                "where": {"all": [{"op": "gt", "left": {"sma": 1}, "right": {"value": 1}}]},
            }
        )

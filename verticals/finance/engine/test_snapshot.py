from decimal import Decimal

from domain.screeners import ScreenerSeries
from engine.fixture import fixture_closes
from engine.screener import screen
from engine.snapshot import market_snapshot
from engine.test_screener import PRICE_RULE


def _series(symbol: str, closes: list[Decimal], volume: str) -> ScreenerSeries:
    return ScreenerSeries("NONE", symbol, tuple(closes), tuple(Decimal(volume) for _ in closes))


def test_snapshot_repeats_and_follows_the_screener():
    closes = fixture_closes()
    flat = [Decimal("50")] * len(closes)
    universe = [_series("BETA", flat, "10"), _series("ACME", closes, "1000")]
    first = market_snapshot(universe, PRICE_RULE)
    second = market_snapshot(list(reversed(universe)), PRICE_RULE)
    screened = screen(universe, PRICE_RULE)
    assert first == second
    assert [point.symbol for point in first.points if point.included] == [item.symbol for item in screened.candidates]
    acme = next(point for point in first.points if point.symbol == "ACME")
    assert acme.bar_index == len(closes) - 1
    assert acme.price == Decimal("123.600000")
    assert {(kind, period) for kind, period, _value in acme.features} == {
        ("sma", 20),
        ("ema", 10),
        ("rsi", 14),
        ("momentum", 1),
        ("volatility", 5),
    }
    assert {(kind, period): value for kind, period, value in acme.features}[("momentum", 1)] == Decimal("0.200000")
    cutoff = market_snapshot(
        [_series("BETA", flat[:41], "10"), _series("ACME", closes[:41], "1000")],
        PRICE_RULE,
    )
    assert cutoff.digest != first.digest
    assert cutoff == market_snapshot(
        [_series("ACME", closes[:41], "1000"), _series("BETA", flat[:41], "10")],
        PRICE_RULE,
    )
    assert cutoff.points[1].bar_index == 40

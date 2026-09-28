from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest

from domain.market_data import OhlcvBar
from engine.ingest import require_fixture_provider, validate_ohlcv_series


def _bar(index: int, close: str, *, hour: int = 0) -> OhlcvBar:
    price = Decimal(close)
    return OhlcvBar(
        index,
        datetime(2024, 1, 1, hour, tzinfo=timezone.utc) + timedelta(days=index),
        price,
        price + Decimal("1"),
        price - Decimal("1"),
        price,
        Decimal("1000"),
    )


def test_fixture_series_is_deterministic():
    bars = [_bar(0, "10"), _bar(1, "11"), _bar(2, "12")]
    assert require_fixture_provider("fixture") == "fixture"
    assert [bar.close for bar in validate_ohlcv_series("1d", bars)] == [
        Decimal("10"),
        Decimal("11"),
        Decimal("12"),
    ]


def test_rejects_broker_provider_and_broken_candles():
    with pytest.raises(ValueError):
        require_fixture_provider("broker")
    with pytest.raises(ValueError):
        validate_ohlcv_series("tick", [_bar(0, "10")])
    decreasing = [_bar(0, "10"), _bar(1, "11")]
    decreasing[1] = OhlcvBar(
        1,
        decreasing[0].bar_time,
        Decimal("11"),
        Decimal("12"),
        Decimal("10"),
        Decimal("11"),
        Decimal("1"),
    )
    with pytest.raises(ValueError):
        validate_ohlcv_series("1h", decreasing)

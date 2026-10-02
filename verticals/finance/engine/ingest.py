from decimal import Decimal

from domain.market_data import OhlcvBar

TIMEFRAMES = frozenset({"1m", "5m", "15m", "1h", "1d", "1w"})
ASSET_CLASSES = frozenset({"equity", "etf", "fx", "crypto", "index"})
FIXTURE_PROVIDER_KIND = "fixture"


def normalize_code(value: str) -> str:
    return value.strip().upper()


def require_fixture_provider(kind: str) -> str:
    if kind != FIXTURE_PROVIDER_KIND:
        raise ValueError("only the fixture data provider is available")
    return kind


def validate_ohlcv_series(timeframe: str, bars: list[OhlcvBar]) -> list[OhlcvBar]:
    if timeframe not in TIMEFRAMES:
        raise ValueError("timeframe is not supported")
    if not bars:
        raise ValueError("market series is empty")
    ordered = tuple(sorted(bars, key=lambda bar: bar.bar_index))
    previous_time = None
    for index, bar in enumerate(ordered):
        if bar.bar_index != index:
            raise ValueError("bar_index must be contiguous from 0")
        if bar.high < bar.low or bar.close <= 0 or bar.volume < 0:
            raise ValueError("ohlcv is invalid")
        if bar.open < bar.low or bar.open > bar.high or bar.close < bar.low or bar.close > bar.high:
            raise ValueError("ohlcv is invalid")
        if previous_time is not None and bar.bar_time <= previous_time:
            raise ValueError("bar_time must increase with bar_index")
        previous_time = bar.bar_time
    return list(ordered)


def series_payload(bars: list[OhlcvBar]) -> list[dict[str, str | int]]:
    payload: list[dict[str, str | int]] = []
    for bar in bars:
        payload.append(
            {
                "bar_index": bar.bar_index,
                "bar_time": bar.bar_time.isoformat(),
                "open": format(bar.open, "f"),
                "high": format(bar.high, "f"),
                "low": format(bar.low, "f"),
                "close": format(bar.close, "f"),
                "volume": format(bar.volume, "f"),
            }
        )
    return payload


def closes_for_timeframe(bars: list[OhlcvBar], timeframe: str) -> list[Decimal]:
    validated = validate_ohlcv_series(timeframe, bars)
    return [bar.close for bar in validated]

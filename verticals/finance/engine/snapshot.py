import hashlib

from domain.screeners import ScreenerSeries
from domain.snapshots import MarketSnapshot, SnapshotPoint
from engine.indicators import quantize
from engine.screener import _eval, _indicator, referenced_periods, validate_screener


def market_snapshot(universe: list[ScreenerSeries], spec: dict) -> MarketSnapshot:
    checked = validate_screener(spec)
    periods = referenced_periods(spec)
    seen: set[tuple[str, str]] = set()
    points: list[SnapshotPoint] = []
    for series in universe:
        identity = (series.exchange, series.symbol)
        if identity in seen:
            raise ValueError("screener universe has a duplicate instrument")
        seen.add(identity)
        if not series.closes:
            continue
        if len(series.closes) != len(series.volumes):
            raise ValueError("screener series closes and volumes differ")
        features = tuple((kind, period, _indicator(series.closes, kind, period)) for kind, period in periods)
        points.append(
            SnapshotPoint(
                series.exchange,
                series.symbol,
                len(series.closes) - 1,
                quantize(series.closes[-1]),
                quantize(series.volumes[-1]),
                _eval(checked["where"], series, {}),
                features,
            )
        )
    ordered = tuple(sorted(points, key=lambda item: (item.exchange, item.symbol)))
    return MarketSnapshot(ordered, snapshot_digest(ordered))


def snapshot_digest(points: tuple[SnapshotPoint, ...]) -> str:
    lines = []
    for point in points:
        rendered = ",".join(
            f"{kind}:{period}=" + ("" if value is None else format(value, "f"))
            for kind, period, value in point.features
        )
        included = "1" if point.included else "0"
        lines.append(
            f"S|{point.exchange}|{point.symbol}|{point.bar_index}|{format(point.price, 'f')}|{format(point.volume, 'f')}|{included}|{rendered}"
        )
    return hashlib.md5("\n".join(lines).encode("utf-8")).hexdigest()

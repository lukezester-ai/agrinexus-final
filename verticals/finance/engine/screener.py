import hashlib
from decimal import Decimal

from domain.screeners import ScreenerCandidate, ScreenerResult, ScreenerSeries
from engine.indicators import ema, quantize, rsi, sma

OPS = {
    "gt": lambda left, right: left > right,
    "gte": lambda left, right: left >= right,
    "lt": lambda left, right: left < right,
    "lte": lambda left, right: left <= right,
}
PERIODS = {
    "sma": (2, 200),
    "ema": (2, 200),
    "rsi": (2, 100),
    "momentum": (1, 200),
    "volatility": (2, 200),
}
SCALARS = {"close", "volume"}
MAX_DEPTH = 3
MAX_COMPARISONS = 8


class ScreenerSpecError(ValueError):
    pass


def validate_screener(spec: dict) -> dict:
    if not isinstance(spec, dict) or set(spec) != {"version", "where"}:
        raise ScreenerSpecError("screener spec is invalid")
    if spec.get("version") != 1 or isinstance(spec.get("version"), bool):
        raise ScreenerSpecError("screener spec is invalid")
    return {"version": 1, "where": _group(spec["where"], 1, [0])}


def screen(universe: list[ScreenerSeries], spec: dict) -> ScreenerResult:
    checked = validate_screener(spec)
    seen: set[tuple[str, str]] = set()
    candidates: list[ScreenerCandidate] = []
    for series in universe:
        identity = (series.exchange, series.symbol)
        if identity in seen:
            raise ValueError("screener universe has a duplicate instrument")
        seen.add(identity)
        if not series.closes:
            continue
        if len(series.closes) != len(series.volumes):
            raise ValueError("screener series closes and volumes differ")
        if _eval(checked["where"], series, {}):
            candidates.append(
                ScreenerCandidate(
                    series.exchange,
                    series.symbol,
                    quantize(series.closes[-1]),
                    quantize(series.volumes[-1]),
                )
            )
    ordered = tuple(sorted(candidates, key=lambda item: (item.exchange, item.symbol)))
    return ScreenerResult(ordered, screener_digest(ordered))


def screener_digest(candidates: tuple[ScreenerCandidate, ...]) -> str:
    lines = [
        f"C|{item.exchange}|{item.symbol}|{format(item.close, 'f')}|{format(item.volume, 'f')}"
        for item in candidates
    ]
    return hashlib.md5("\n".join(lines).encode("utf-8")).hexdigest()


def _group(node: object, depth: int, count: list[int]) -> dict:
    if not isinstance(node, dict) or len(node) != 1:
        raise ScreenerSpecError("screener spec is invalid")
    key = next(iter(node))
    if key not in {"all", "any"} or depth > MAX_DEPTH:
        raise ScreenerSpecError("screener spec is invalid")
    children = node[key]
    if not isinstance(children, list) or not 1 <= len(children) <= MAX_COMPARISONS:
        raise ScreenerSpecError("screener spec is invalid")
    parsed = []
    for child in children:
        if isinstance(child, dict) and set(child) <= {"all", "any"} and len(child) == 1:
            parsed.append(_group(child, depth + 1, count))
        else:
            parsed.append(_comparison(child, count))
    return {key: parsed}


def _comparison(node: object, count: list[int]) -> dict:
    count[0] += 1
    if count[0] > MAX_COMPARISONS or not isinstance(node, dict) or set(node) != {"op", "left", "right"}:
        raise ScreenerSpecError("screener spec is invalid")
    op = node["op"]
    if op not in OPS:
        raise ScreenerSpecError("screener spec is invalid")
    return {"op": op, "left": _operand(node["left"]), "right": _operand(node["right"])}


def _operand(node: object) -> dict:
    if not isinstance(node, dict) or len(node) != 1:
        raise ScreenerSpecError("screener spec is invalid")
    key, value = next(iter(node.items()))
    if key in SCALARS:
        if value is not True:
            raise ScreenerSpecError("screener spec is invalid")
        return {key: True}
    if key == "value":
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ScreenerSpecError("screener spec is invalid")
        number = Decimal(str(value))
        if not number.is_finite() or abs(number) > Decimal("1000000000"):
            raise ScreenerSpecError("screener spec is invalid")
        return {"value": value}
    bounds = PERIODS.get(key)
    if bounds is None or isinstance(value, bool) or not isinstance(value, int) or not bounds[0] <= value <= bounds[1]:
        raise ScreenerSpecError("screener spec is invalid")
    return {key: value}


def _eval(node: dict, series: ScreenerSeries, cache: dict) -> bool:
    if "all" in node:
        return all(_eval(child, series, cache) for child in node["all"])
    if "any" in node:
        return any(_eval(child, series, cache) for child in node["any"])
    left = _value(node["left"], series, cache)
    right = _value(node["right"], series, cache)
    if left is None or right is None:
        return False
    return OPS[node["op"]](left, right)


def _value(operand: dict, series: ScreenerSeries, cache: dict) -> Decimal | None:
    key, raw = next(iter(operand.items()))
    if key == "close":
        return series.closes[-1]
    if key == "volume":
        return series.volumes[-1]
    if key == "value":
        return Decimal(str(raw))
    cached = cache.setdefault(key, {})
    if raw not in cached:
        cached[raw] = _indicator(series.closes, key, raw)
    return cached[raw]


def _indicator(closes: tuple[Decimal, ...], kind: str, period: int) -> Decimal | None:
    points = list(closes)
    if kind == "sma":
        return sma(points, period)[-1]
    if kind == "ema":
        return ema(points, period)[-1]
    if kind == "rsi":
        return rsi(points, period)[-1]
    if kind == "momentum":
        if len(points) <= period:
            return None
        return quantize(points[-1] - points[-1 - period])
    if kind == "volatility":
        if len(points) < period or points[-1] == 0:
            return None
        window = points[-period:]
        return quantize((max(window) - min(window)) / points[-1])
    raise ScreenerSpecError("screener spec is invalid")

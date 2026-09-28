from dataclasses import dataclass
from decimal import Decimal

from engine.indicators import ema, rsi, sma
from engine.strategy import StrategySpecError

OPS = {"gt": lambda left, right: left > right, "gte": lambda left, right: left >= right, "lt": lambda left, right: left < right, "lte": lambda left, right: left <= right}
PERIODS = {"sma": (2, 200), "ema": (2, 200), "rsi": (2, 100)}
MAX_DEPTH = 3
MAX_COMPARISONS = 8


@dataclass(frozen=True)
class SpecSignal:
    bar_index: int
    entry_on: bool
    exit_on: bool
    position: int


def validate_spec(spec: dict) -> dict:
    if not isinstance(spec, dict) or set(spec) != {"version", "entry", "exit"}:
        raise StrategySpecError("strategy spec is invalid")
    if spec.get("version") != 2 or isinstance(spec.get("version"), bool):
        raise StrategySpecError("strategy spec is invalid")
    entry = _group(spec["entry"], 1, [0])
    exit_rule = _group(spec["exit"], 1, [0])
    return {"version": 2, "entry": entry, "exit": exit_rule}


def execute_spec(closes: list[Decimal], spec: dict) -> list[SpecSignal]:
    checked = validate_spec(spec)
    series = {
        "sma": {period: sma(closes, period) for period in _periods(checked, "sma")},
        "ema": {period: ema(closes, period) for period in _periods(checked, "ema")},
        "rsi": {period: rsi(closes, period) for period in _periods(checked, "rsi")},
    }
    position = 0
    signals: list[SpecSignal] = []
    for index, close in enumerate(closes):
        snapshot = {"close": close, "sma": {}, "ema": {}, "rsi": {}}
        for kind in ("sma", "ema", "rsi"):
            for period, values in series[kind].items():
                snapshot[kind][period] = values[index]
        entry_on = _eval(checked["entry"], snapshot)
        exit_on = _eval(checked["exit"], snapshot)
        if position == 0 and entry_on:
            position = 1
        elif position == 1 and exit_on:
            position = 0
        signals.append(SpecSignal(index, entry_on, exit_on, position))
    return signals


def _group(node: object, depth: int, count: list[int]) -> dict:
    if not isinstance(node, dict) or len(node) != 1:
        raise StrategySpecError("strategy spec is invalid")
    key = next(iter(node))
    if key not in {"all", "any"} or depth > MAX_DEPTH:
        raise StrategySpecError("strategy spec is invalid")
    children = node[key]
    if not isinstance(children, list) or not 1 <= len(children) <= MAX_COMPARISONS:
        raise StrategySpecError("strategy spec is invalid")
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
        raise StrategySpecError("strategy spec is invalid")
    op = node["op"]
    if op not in OPS:
        raise StrategySpecError("strategy spec is invalid")
    return {"op": op, "left": _operand(node["left"]), "right": _operand(node["right"])}


def _operand(node: object) -> dict:
    if not isinstance(node, dict) or len(node) != 1:
        raise StrategySpecError("strategy spec is invalid")
    key, value = next(iter(node.items()))
    if key == "close":
        if value is not True:
            raise StrategySpecError("strategy spec is invalid")
        return {"close": True}
    if key == "value":
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise StrategySpecError("strategy spec is invalid")
        number = Decimal(str(value))
        if not number.is_finite() or abs(number) > Decimal("1000000000"):
            raise StrategySpecError("strategy spec is invalid")
        return {"value": value}
    bounds = PERIODS.get(key)
    if bounds is None or isinstance(value, bool) or not isinstance(value, int) or not bounds[0] <= value <= bounds[1]:
        raise StrategySpecError("strategy spec is invalid")
    return {key: value}


def _periods(spec: dict, kind: str) -> set[int]:
    found: set[int] = set()

    def walk(node: dict) -> None:
        if "op" in node:
            for side in ("left", "right"):
                if kind in node[side]:
                    found.add(node[side][kind])
            return
        key = "all" if "all" in node else "any"
        for child in node[key]:
            walk(child)

    walk(spec["entry"])
    walk(spec["exit"])
    return found


def _eval(node: dict, snapshot: dict) -> bool:
    if "all" in node:
        return all(_eval(child, snapshot) for child in node["all"])
    if "any" in node:
        return any(_eval(child, snapshot) for child in node["any"])
    left = _value(node["left"], snapshot)
    right = _value(node["right"], snapshot)
    if left is None or right is None:
        return False
    return OPS[node["op"]](left, right)


def _value(operand: dict, snapshot: dict) -> Decimal | None:
    if "close" in operand:
        return snapshot["close"]
    if "value" in operand:
        return Decimal(str(operand["value"]))
    kind = next(iter(operand))
    return snapshot[kind][operand[kind]]

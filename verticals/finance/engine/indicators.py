from decimal import Decimal, ROUND_HALF_UP

from domain.indicators import IndicatorPoint

QUANTUM = Decimal("0.000001")
SMA_FAST = 20
SMA_SLOW = 50
RSI_PERIOD = 14
RSI_MAX = Decimal("70")


def quantize(value: Decimal) -> Decimal:
    return value.quantize(QUANTUM, rounding=ROUND_HALF_UP)


def ema(closes: list[Decimal], period: int) -> list[Decimal | None]:
    points: list[Decimal | None] = [None] * len(closes)
    if len(closes) < period or period < 2:
        return points
    seed = sum(closes[:period], Decimal("0")) / Decimal(period)
    points[period - 1] = quantize(seed)
    multiplier = Decimal(2) / Decimal(period + 1)
    previous = seed
    for index in range(period, len(closes)):
        previous = (closes[index] - previous) * multiplier + previous
        points[index] = quantize(previous)
    return points


def sma(closes: list[Decimal], period: int) -> list[Decimal | None]:
    points: list[Decimal | None] = []
    for index in range(len(closes)):
        if index + 1 < period:
            points.append(None)
            continue
        window = closes[index + 1 - period : index + 1]
        points.append(quantize(sum(window, Decimal("0")) / Decimal(period)))
    return points


def _rsi_value(avg_gain: Decimal, avg_loss: Decimal) -> Decimal:
    if avg_loss == 0:
        return Decimal("100")
    relative = avg_gain / avg_loss
    return Decimal("100") - (Decimal("100") / (Decimal("1") + relative))


def rsi(closes: list[Decimal], period: int = RSI_PERIOD) -> list[Decimal | None]:
    count = len(closes)
    points: list[Decimal | None] = [None] * count
    if count <= period:
        return points
    gains: list[Decimal] = []
    losses: list[Decimal] = []
    for index in range(1, period + 1):
        delta = closes[index] - closes[index - 1]
        gains.append(delta if delta > 0 else Decimal("0"))
        losses.append(-delta if delta < 0 else Decimal("0"))
    avg_gain = sum(gains, Decimal("0")) / Decimal(period)
    avg_loss = sum(losses, Decimal("0")) / Decimal(period)
    points[period] = quantize(_rsi_value(avg_gain, avg_loss))
    for index in range(period + 1, count):
        delta = closes[index] - closes[index - 1]
        gain = delta if delta > 0 else Decimal("0")
        loss = -delta if delta < 0 else Decimal("0")
        avg_gain = (avg_gain * Decimal(period - 1) + gain) / Decimal(period)
        avg_loss = (avg_loss * Decimal(period - 1) + loss) / Decimal(period)
        points[index] = quantize(_rsi_value(avg_gain, avg_loss))
    return points


def indicator_frame(closes: list[Decimal]) -> list[IndicatorPoint]:
    fast = sma(closes, SMA_FAST)
    slow = sma(closes, SMA_SLOW)
    momentum = rsi(closes, RSI_PERIOD)
    frame: list[IndicatorPoint] = []
    for index, close in enumerate(closes):
        del close
        sma_fast = fast[index]
        sma_slow = slow[index]
        rsi_value = momentum[index]
        signal = (
            sma_fast is not None
            and sma_slow is not None
            and rsi_value is not None
            and sma_fast > sma_slow
            and rsi_value < RSI_MAX
        )
        frame.append(
            IndicatorPoint(
                bar_index=index,
                sma_fast=sma_fast,
                sma_slow=sma_slow,
                rsi=rsi_value,
                signal=signal,
            )
        )
    return frame

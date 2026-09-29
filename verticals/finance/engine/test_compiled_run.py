import inspect
import json
from decimal import Decimal

import pytest

from domain.strategies import V2_LONG_RULE
from engine import compiled_run
from engine.book import run_spec_book
from engine.compiled_run import run_compiled_on_snapshot
from engine.copilot import specification_digest
from engine.dsl import validate_spec
from engine.fixture import fixture_closes
from engine.snapshot import market_snapshot
from engine.strategy import StrategySpecError
from engine.test_copilot import SENTENCE
from engine.test_screener import PRICE_RULE, _series


def test_compiled_spec_matches_the_manual_spec_on_the_snapshot():
    closes = fixture_closes()
    later = closes + [closes[-1] + Decimal("0.20")]
    flat = [Decimal("50")] * len(closes)
    snapshot = market_snapshot(
        [_series("BETA", flat, "10"), _series("ACME", closes, "1000")],
        PRICE_RULE,
    )
    acme = next(point for point in snapshot.points if point.symbol == "ACME")
    beta = next(point for point in snapshot.points if point.symbol == "BETA")
    compiled, book = run_compiled_on_snapshot(SENTENCE, json.dumps(V2_LONG_RULE), later, acme)
    manual = validate_spec(V2_LONG_RULE)
    manual_book = run_spec_book(closes, manual)
    assert acme.included is True
    assert beta.included is False
    assert compiled.spec == manual
    assert compiled.digest == specification_digest(manual)
    assert book == manual_book
    assert run_spec_book(later, manual).digest != book.digest
    with pytest.raises(ValueError):
        run_compiled_on_snapshot(SENTENCE, V2_LONG_RULE, closes, beta)
    with pytest.raises(StrategySpecError):
        run_compiled_on_snapshot(SENTENCE, {"action": "buy", "broker": "live"}, later, acme)


def test_compiled_run_delegates_and_does_not_calculate_indicators():
    source = inspect.getsource(compiled_run)
    for name in ("compile_model_output", "validate_spec", "run_spec_book"):
        assert name in source
    for name in ("sma(", "ema(", "rsi(", "metrics_from_equity", "apply_paper", "broker"):
        assert name not in source

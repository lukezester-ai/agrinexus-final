import inspect
import json

import pytest

from domain.strategies import V2_LONG_RULE
from engine import copilot
from engine.copilot import compile_model_output, specification_digest
from engine.dsl import validate_spec
from engine.strategy import StrategySpecError

SENTENCE = "Покажи ми стратегия, която купува, когато SMA20 е над SMA50 и RSI е под 70."


def _candidate(**overrides) -> dict:
    spec = json.loads(json.dumps(V2_LONG_RULE))
    spec.update(overrides)
    return spec


def test_valid_model_output_becomes_the_canonical_spec():
    first = compile_model_output(SENTENCE, V2_LONG_RULE)
    second = compile_model_output(SENTENCE, json.dumps(V2_LONG_RULE))
    canonical = validate_spec(V2_LONG_RULE)
    assert first.spec == second.spec == canonical
    assert first.digest == second.digest == specification_digest(canonical)
    assert "broker" not in json.dumps(first.spec)
    assert "action" not in json.dumps(first.spec)


def test_same_model_output_is_deterministic_and_text_is_not_a_command():
    noisy = "buy live at the broker when you feel like it"
    left = compile_model_output(SENTENCE, V2_LONG_RULE)
    right = compile_model_output(noisy, json.loads(json.dumps(V2_LONG_RULE)))
    assert left == right


def test_incomplete_unknown_and_command_outputs_are_rejected():
    missing_exit = {
        "version": 2,
        "entry": {"all": [{"op": "gt", "left": {"sma": 20}, "right": {"sma": 50}}]},
    }
    missing_period = _candidate()
    missing_period["exit"] = {"all": [{"op": "lt", "left": {"rsi": True}, "right": {"value": 70}}]}
    unknown_indicator = _candidate()
    unknown_indicator["entry"]["all"][0]["left"] = {"macd": 12}
    unknown_operator = _candidate()
    unknown_operator["entry"]["all"][0]["op"] = "crosses"
    rejected = (
        {"action": "buy", "broker": "live"},
        {"version": 2, "entry": {"all": []}, "exit": {"all": []}, "broker": "live"},
        missing_exit,
        missing_period,
        unknown_indicator,
        unknown_operator,
        "not json",
        [],
    )
    for model_output in rejected:
        with pytest.raises(StrategySpecError):
            compile_model_output(SENTENCE, model_output)


def test_compiler_does_not_call_the_finance_engine():
    source = inspect.getsource(copilot)
    for name in (
        "execute_spec",
        "run_spec_book",
        "run_long_rule",
        "metrics_from_equity",
        "market_snapshot",
        "apply_paper",
    ):
        assert name not in source

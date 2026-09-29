import inspect
import json

import pytest

from engine import policy
from engine.policy import RiskPolicyError, policy_digest, validate_risk_policy


def _document(**overrides) -> dict:
    document = {
        "max_risk_per_position": 0.25,
        "max_exposure": 1,
        "max_drawdown": 0.2,
        "max_concurrent_positions": 2,
        "allowed_instruments": ["BETA", "ACME"],
        "allowed_strategies": ["long-v2"],
        "forbidden_actions": [],
    }
    document.update(overrides)
    return document


def test_same_policy_has_one_canonical_digest():
    first = validate_risk_policy(_document())
    second = validate_risk_policy(
        {
            "forbidden_actions": [],
            "allowed_strategies": ["long-v2"],
            "allowed_instruments": ["ACME", "BETA"],
            "max_concurrent_positions": 2,
            "max_drawdown": 0.2,
            "max_exposure": 1,
            "max_risk_per_position": 0.25,
        }
    )
    assert first == second
    assert first["allowed_instruments"] == ["ACME", "BETA"]
    assert policy_digest(first) == policy_digest(second)
    assert "organization_id" not in first


def test_a_different_policy_has_a_different_digest():
    original = policy_digest(validate_risk_policy(_document()))
    changed = policy_digest(validate_risk_policy(_document(max_drawdown=0.3)))
    assert original != changed


def test_incomplete_unknown_and_command_policies_are_rejected():
    missing = _document()
    del missing["max_exposure"]
    rejected = (
        missing,
        _document(organization_id="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
        _document(broker="live"),
        _document(live=True),
        _document(max_risk_per_position=-1),
        _document(max_concurrent_positions=1.5),
        _document(max_drawdown=True),
        _document(allowed_instruments=["ACME", "ACME"]),
        _document(forbidden_actions=["broker"]),
        _document(forbidden_actions=["live"]),
        _document(allowed_strategies=[" "]),
        [],
        "not json",
    )
    for document in rejected:
        with pytest.raises(RiskPolicyError):
            validate_risk_policy(document)
    parsed = json.loads(json.dumps(_document()))
    assert validate_risk_policy(parsed)["max_exposure"] == 1


def test_policy_does_not_evaluate_a_strategy():
    source = inspect.getsource(policy)
    for name in (
        "run_spec_book",
        "metrics_from_equity",
        "compile_model_output",
        "finance_apply_paper_book",
        "finance_approve_strategy_result",
        "execute_spec",
    ):
        assert name not in source

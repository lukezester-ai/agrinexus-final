from pathlib import Path

from engine.book import run_spec_book
from engine.evaluation import evaluate_policy
from engine.fixture import fixture_closes
from engine.test_book import ALWAYS_LONG


def _metrics():
    book = run_spec_book(fixture_closes(), ALWAYS_LONG)
    return book


def _policy(**overrides) -> dict:
    document = {
        "max_risk_per_position": 1,
        "max_exposure": 1000000,
        "max_drawdown": 1,
        "max_concurrent_positions": 1,
        "allowed_instruments": ["ACME"],
        "allowed_strategies": ["Open"],
        "forbidden_actions": [],
    }
    document.update(overrides)
    return document


def _evaluate(policy: dict):
    book = _metrics()
    return evaluate_policy(
        policy,
        "Open",
        "ACME",
        book.stats.max_drawdown,
        book.allocation.market_value,
        book.allocation.position_weight,
        book.allocation.quantity,
        bool(book.ledger),
    )


def test_same_policy_and_book_repeat_and_a_changed_policy_changes_the_digest():
    book = _metrics()
    assert book.stats.max_drawdown > 0
    assert book.allocation.market_value > 0
    assert book.allocation.position_weight > 0
    assert book.allocation.quantity > 0
    assert book.ledger
    first = _evaluate(_policy())
    second = _evaluate(_policy())
    assert first.accepted is True
    assert first.denials == ()
    assert first.digest == second.digest
    changed = _evaluate(_policy(max_exposure=2000000))
    assert changed.accepted is True
    assert changed.digest != first.digest


def test_each_policy_breach_is_a_denial():
    cases = (
        (_policy(allowed_strategies=["Closed"]), ("strategy",)),
        (_policy(allowed_instruments=["BETA"]), ("instrument",)),
        (_policy(max_drawdown=0), ("max_drawdown",)),
        (_policy(max_exposure=0), ("max_exposure",)),
        (_policy(max_risk_per_position=0), ("max_risk_per_position",)),
        (_policy(max_concurrent_positions=0), ("max_concurrent_positions",)),
        (_policy(forbidden_actions=["long"]), ("forbidden_action",)),
    )
    for policy, expected in cases:
        result = _evaluate(policy)
        assert result.accepted is False
        assert result.denials == expected


def test_evaluation_reads_existing_metrics():
    source = Path(__file__).with_name("evaluation.py").read_text(encoding="utf-8")
    for name in (
        "metrics_from_equity",
        "run_spec_book",
        "finance_apply_paper_book",
        "finance_approve_strategy_result",
        "peak",
    ):
        assert name not in source

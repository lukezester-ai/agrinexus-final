from pathlib import Path

from engine.recheck import recheck_matches


def test_recheck_is_a_digest_comparison():
    assert recheck_matches("eval", "eval", True, "policy", "policy") is True
    assert recheck_matches("eval", "other", True, "policy", "policy") is False
    assert recheck_matches("eval", "eval", False, "policy", "policy") is False
    assert recheck_matches("eval", "eval", True, "policy", "changed") is False


def test_recheck_does_not_calculate_or_authorize():
    source = Path(__file__).with_name("recheck.py").read_text(encoding="utf-8")
    for name in (
        "metrics_from_equity",
        "finance_evaluate_risk_policy",
        "finance_apply_paper_book",
        "finance_create_order_intent",
        "peak",
        "authoriz",
    ):
        assert name not in source

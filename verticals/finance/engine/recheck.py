"""Compare a stored order intent with the current evaluation and policy."""

from __future__ import annotations


def recheck_matches(
    intent_evaluation_digest: str,
    current_evaluation_digest: str,
    accepted: bool,
    evaluation_policy_digest: str,
    current_policy_digest: str,
) -> bool:
    return (
        accepted is True
        and intent_evaluation_digest == current_evaluation_digest
        and evaluation_policy_digest == current_policy_digest
    )

from domain.strategies import V1_LONG_RULE


class StrategySpecError(ValueError):
    pass


def require_v1_long_rule(spec: dict) -> None:
    if spec != V1_LONG_RULE:
        raise StrategySpecError("strategy spec is not the v1 long rule")

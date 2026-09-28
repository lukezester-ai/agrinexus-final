from decimal import Decimal


def fixture_closes() -> list[Decimal]:
    """Rise, cool off, then rise again so the v1 rule can enter and exit."""
    closes: list[Decimal] = []
    price = Decimal("100")
    for index in range(70):
        if index < 36:
            price += Decimal("0.80")
        elif index < 52:
            price -= Decimal("0.55")
        else:
            price += Decimal("0.20")
        closes.append(price)
    return closes

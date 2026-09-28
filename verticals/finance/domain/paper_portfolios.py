from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class PaperPortfolio:
    organization_id: str
    name: str
    cash: Decimal

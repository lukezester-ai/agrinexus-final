from dataclasses import dataclass


@dataclass(frozen=True)
class Instrument:
    organization_id: str
    symbol: str
    name: str
    exchange: str = "NONE"
    asset_class: str = "equity"
    currency: str = "USD"

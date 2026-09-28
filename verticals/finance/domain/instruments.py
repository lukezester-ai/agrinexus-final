from dataclasses import dataclass


@dataclass(frozen=True)
class Instrument:
    organization_id: str
    symbol: str
    name: str

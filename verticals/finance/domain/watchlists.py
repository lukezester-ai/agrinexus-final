from dataclasses import dataclass


@dataclass(frozen=True)
class Watchlist:
    organization_id: str
    name: str

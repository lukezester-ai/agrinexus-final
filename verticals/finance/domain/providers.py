from dataclasses import dataclass


FIXTURE_PROVIDER_KIND = "fixture"


@dataclass(frozen=True)
class DataProvider:
    organization_id: str
    name: str
    kind: str = FIXTURE_PROVIDER_KIND

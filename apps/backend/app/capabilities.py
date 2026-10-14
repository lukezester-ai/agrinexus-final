"""Stable discovery boundary for optional vertical capabilities."""

from __future__ import annotations

from dataclasses import dataclass
from importlib.metadata import entry_points
from typing import Callable, Protocol


@dataclass(frozen=True)
class Capability:
	name: str
	package: str


class CapabilityFactory(Protocol):
	def __call__(self) -> Capability: ...


CAPABILITY_ENTRY_POINT_GROUP = "agrinexus.capabilities"


def discover_capabilities() -> dict[str, Capability]:
	"""Load installed verticals without importing implementations from core."""
	discovered: dict[str, Capability] = {}
	for entry_point in entry_points(group=CAPABILITY_ENTRY_POINT_GROUP):
		factory: Callable[[], Capability] = entry_point.load()
		capability = factory()
		discovered[capability.name] = capability
	return discovered

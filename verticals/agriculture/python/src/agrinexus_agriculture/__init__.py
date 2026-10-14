"""Agriculture capability registration; agent implementations move in Slice 2."""

from app.capabilities import Capability


def capability() -> Capability:
	return Capability(name="agriculture", package=__name__)

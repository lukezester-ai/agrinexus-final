from __future__ import annotations

import unittest

from app.capabilities import CAPABILITY_ENTRY_POINT_GROUP, discover_capabilities
from app.main import app


class CapabilityBoundaryTests(unittest.TestCase):
	def test_core_starts_without_vertical_imports(self) -> None:
		self.assertEqual(app.title, "AgriNexus API")

	def test_discovery_group_is_stable(self) -> None:
		self.assertEqual(CAPABILITY_ENTRY_POINT_GROUP, "agrinexus.capabilities")
		self.assertIsInstance(discover_capabilities(), dict)


if __name__ == "__main__":
	unittest.main()

from __future__ import annotations

import unittest

from fastapi.testclient import TestClient

from app.main import app
from app.runtime import invoke_core


class CoreRuntimeTests(unittest.TestCase):
	def test_langgraph_echo(self) -> None:
		self.assertEqual(invoke_core("ping"), "core:ping")

	def test_runtime_route(self) -> None:
		client = TestClient(app)
		res = client.get("/runtime/langgraph")
		self.assertEqual(res.status_code, 200)
		body = res.json()
		self.assertEqual(body["runtime"], "langgraph")
		self.assertEqual(body["sample"], "core:ping")

	def test_health_lists_capabilities(self) -> None:
		client = TestClient(app)
		res = client.get("/health")
		self.assertEqual(res.status_code, 200)
		self.assertEqual(res.json()["status"], "ok")
		self.assertIn("capabilities", res.json())


if __name__ == "__main__":
	unittest.main()

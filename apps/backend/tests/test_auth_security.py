import os
import time
import unittest
from unittest.mock import patch

import jwt
from fastapi import HTTPException
from fastapi.testclient import TestClient
from app.main import app, TokenRequest, create_access_token, auth_me, health


class AuthSecurityTests(unittest.TestCase):
    def test_http_auth_fails_closed_without_breaking_startup(self):
        with patch.dict(os.environ, {"JWT_SECRET": ""}), TestClient(app) as client:
            self.assertEqual(client.get("/health").status_code, 200)
            self.assertEqual(client.get("/runtime/langgraph").status_code, 200)
            response = client.post("/auth/token", json={"email": "victim@example.com"})
            self.assertEqual(response.status_code, 501)
            self.assertNotIn("access_token", response.json())
            self.assertEqual(client.get("/auth/me").status_code, 401)
            self.assertEqual(client.get("/auth/me", headers={"Authorization": "Bearer forged"}).status_code, 503)

    def test_email_alone_never_issues_token(self):
        with self.assertRaises(HTTPException) as error:
            create_access_token(TokenRequest(email="victim@example.com"))
        self.assertEqual(error.exception.status_code, 501)

    def test_missing_or_known_secret_fails_closed(self):
        for secret in ("", "short", "agrinexus-dev-jwt-secret-change-me"):
            with patch.dict(os.environ, {"JWT_SECRET": secret}):
                with self.assertRaises(HTTPException) as error:
                    auth_me("Bearer anything")
                self.assertEqual(error.exception.status_code, 503)
                self.assertEqual(health()["status"], "ok")

    def test_expiration_required(self):
        secret = "test-only-secret-" * 4
        with patch.dict(os.environ, {"JWT_SECRET": secret}):
            token = jwt.encode({"sub": "user@example.com"}, secret, algorithm="HS256")
            with self.assertRaises(HTTPException) as error:
                auth_me("Bearer " + token)
            self.assertEqual(error.exception.status_code, 401)

    def test_valid_signed_token_is_accepted(self):
        secret = "test-only-secret-" * 4
        with patch.dict(os.environ, {"JWT_SECRET": secret}):
            token = jwt.encode({"sub": "user@example.com", "exp": int(time.time()) + 60}, secret, algorithm="HS256")
            self.assertEqual(auth_me("Bearer " + token), {"email": "user@example.com"})

    def test_expired_and_wrong_signature_are_rejected(self):
        secret = "test-only-secret-" * 4
        with patch.dict(os.environ, {"JWT_SECRET": secret}):
            for signing_key, expiry in ((secret, 1), ("wrong-key-" * 8, int(time.time()) + 60)):
                token = jwt.encode({"sub": "user@example.com", "exp": expiry}, signing_key, algorithm="HS256")
                with self.assertRaises(HTTPException) as error:
                    auth_me("Bearer " + token)
                self.assertEqual(error.exception.status_code, 401)

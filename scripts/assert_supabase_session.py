"""Prove auth.uid() is a GoTrue user, not a locally typed claim.

Signs in through Supabase Auth (POST /auth/v1/token). Does not call the
FastAPI POST /auth/token stub. Then shows that the platform auth.uid()
ignores the local helper GUC and returns the signed-in user only after
request.jwt.claim.sub is set from that session.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import sys
import time
import urllib.error
import urllib.request

import psycopg2

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
AUTH_URL = os.environ.get("SUPABASE_AUTH_URL", "").rstrip("/") or (
    f"{SUPABASE_URL}/auth/v1" if SUPABASE_URL else ""
)
ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")
APP_DSN = os.environ.get("DB_URL_APPUSER", "")
PASSWORD = "CoreGate-Pass-1"

USERS = (
    ("11111111-1111-1111-1111-111111111111", "core-owner-a@minimal-core.test"),
    ("22222222-2222-2222-2222-222222222222", "core-member-a@minimal-core.test"),
    ("33333333-3333-3333-3333-333333333333", "core-owner-b@minimal-core.test"),
    ("44444444-4444-4444-4444-444444444444", "core-viewer-a@minimal-core.test"),
    ("55555555-5555-5555-5555-555555555555", "core-admin-a@minimal-core.test"),
)


def fail(message: str) -> None:
    print(f"FAIL {message}", file=sys.stderr)
    raise SystemExit(1)


def ok(message: str) -> None:
    print(f"PASS {message}")


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def sign_hs256(payload: dict, secret: str) -> str:
    header = b64url(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    body = b64url(json.dumps(payload, separators=(",", ":")).encode())
    signature = hmac.new(secret.encode(), f"{header}.{body}".encode(), hashlib.sha256).digest()
    return f"{header}.{body}.{b64url(signature)}"


def derive_api_keys() -> tuple[str, str]:
    now = int(time.time())
    exp = now + 60 * 60 * 24 * 365
    anon = sign_hs256({"role": "anon", "iss": "supabase", "iat": now, "exp": exp}, JWT_SECRET)
    service = sign_hs256(
        {"role": "service_role", "iss": "supabase", "iat": now, "exp": exp},
        JWT_SECRET,
    )
    return anon, service


def require_env() -> None:
    global ANON_KEY, SERVICE_KEY
    if not AUTH_URL or not APP_DSN:
        fail("SUPABASE_AUTH_URL or SUPABASE_URL, and DB_URL_APPUSER, are required")
    if AUTH_URL.rstrip("/").endswith("/auth/token"):
        fail("auth URL is the application POST /auth/token route")
    if not ANON_KEY or not SERVICE_KEY:
        if not JWT_SECRET:
            fail("SUPABASE_JWT_SECRET or both API keys are required")
        ANON_KEY, SERVICE_KEY = derive_api_keys()


def request_json(method: str, url: str, body: dict | None, headers: dict[str, str]) -> dict:
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            payload = json.loads(response.read().decode())
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")
        if "access_token" in detail or "service_role" in detail:
            detail = "response redacted"
        fail(f"{method} {url} returned {exc.code}: {detail[:300]}")
    if not isinstance(payload, dict):
        fail(f"{method} {url} did not return an object")
    return payload


def jwt_payload(token: str) -> dict:
    try:
        part = token.split(".")[1]
    except IndexError:
        fail("Auth response did not contain a JWT")
    padded = part + "=" * (-len(part) % 4)
    try:
        payload = json.loads(base64.urlsafe_b64decode(padded))
    except (ValueError, json.JSONDecodeError):
        fail("Auth JWT payload could not be read")
    if not isinstance(payload, dict):
        fail("Auth JWT payload is not an object")
    return payload


def ensure_user_allow_existing(user_id: str, email: str) -> None:
    data = json.dumps(
        {
            "id": user_id,
            "email": email,
            "password": PASSWORD,
            "email_confirm": True,
        }
    ).encode()
    req = urllib.request.Request(
        f"{AUTH_URL}/admin/users",
        data=data,
        headers={
            "apikey": SERVICE_KEY,
            "Authorization": f"Bearer {SERVICE_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            payload = json.loads(response.read().decode())
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")
        if exc.code in (409, 422) and (
            "already" in detail.lower() or "exists" in detail.lower() or "duplicate" in detail.lower()
        ):
            return
        fail(f"admin create user returned {exc.code}")
    created = str(payload.get("id", ""))
    if created and created != user_id:
        fail(f"GoTrue assigned {created} instead of the requested user id")


def sign_in(email: str) -> str:
    payload = request_json(
        "POST",
        f"{AUTH_URL}/token?grant_type=password",
        {"email": email, "password": PASSWORD},
        {"apikey": ANON_KEY, "Content-Type": "application/json"},
    )
    token = payload.get("access_token")
    if not isinstance(token, str) or token.count(".") != 2:
        fail("GoTrue did not return an access token")
    return token


def confirmed_user(token: str) -> str:
    payload = request_json(
        "GET",
        f"{AUTH_URL}/user",
        None,
        {"apikey": ANON_KEY, "Authorization": f"Bearer {token}"},
    )
    user_id = payload.get("id")
    if not isinstance(user_id, str):
        fail("GoTrue /user did not return an id")
    return user_id


def assert_uid(user_id: str, token: str) -> None:
    claims = jwt_payload(token)
    if claims.get("sub") != user_id:
        fail("JWT sub is not the GoTrue user id")
    if claims.get("role") != "authenticated":
        fail(f"JWT role is {claims.get('role')}")
    conn = psycopg2.connect(APP_DSN)
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT current_user, session_user")
            current, session = cur.fetchone()
            if current != "app_user" or session != "app_user":
                fail(f"session context is {current}/{session}")
            cur.execute(
                """
                SELECT
                    set_config('request.jwt.claims.sub', %s, true),
                    set_config('request.jwt.claim.sub', '', true),
                    set_config('request.jwt.claims', '', true)
                """,
                (user_id,),
            )
            cur.fetchone()
            cur.execute("SELECT auth.uid()")
            helper_only = cur.fetchone()[0]
            if helper_only is not None:
                fail("auth.uid() followed the local helper GUC")
            issued = json.dumps(
                {"sub": user_id, "role": "authenticated", "aud": claims.get("aud", "authenticated")}
            )
            cur.execute(
                """
                SELECT
                    set_config('request.jwt.claim.sub', %s, true),
                    set_config('request.jwt.claims', %s, true)
                """,
                (user_id, issued),
            )
            cur.fetchone()
            cur.execute("SELECT auth.uid()")
            uid = cur.fetchone()[0]
            if str(uid) != user_id:
                fail(f"auth.uid()={uid} after the GoTrue session claim")
        conn.rollback()
    finally:
        conn.close()


def main() -> None:
    require_env()
    for user_id, email in USERS:
        ensure_user_allow_existing(user_id, email)
        token = sign_in(email)
        confirmed = confirmed_user(token)
        if confirmed != user_id:
            fail(f"GoTrue /user returned {confirmed} for {email}")
        assert_uid(user_id, token)
        ok(f"{email} session is auth.uid()")
    ok("five GoTrue users bind to auth.uid() as app_user; POST /auth/token was not called")


if __name__ == "__main__":
    main()

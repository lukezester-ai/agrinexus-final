"""AgriNexus FastAPI backend (scaffold)."""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import Any

import jwt
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.capabilities import discover_capabilities


def _cors_origins() -> list[str]:
	raw = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
	return [o.strip() for o in raw.split(",") if o.strip()]


def _jwt_secret() -> str:
	secret = os.getenv("JWT_SECRET", "").strip()
	if len(secret) < 32 or secret == "agrinexus-dev-jwt-secret-change-me":
		raise HTTPException(status_code=503, detail="authentication_not_configured")
	return secret


JWT_ALGORITHM = "HS256"


@asynccontextmanager
async def lifespan(app: FastAPI):
	# Place DB pool / Redis here later
	yield


app = FastAPI(title="AgriNexus API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
	CORSMiddleware,
	allow_origins=_cors_origins(),
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)


class TokenRequest(BaseModel):
	email: str = Field(..., min_length=3, max_length=320)


@app.get("/health")
def health() -> dict[str, Any]:
	return {
		"status": "ok",
		"capabilities": sorted(discover_capabilities()),
	}


@app.get("/runtime/langgraph")
def runtime_langgraph() -> dict[str, str]:
	from app.runtime import invoke_core

	return {"runtime": "langgraph", "sample": invoke_core("ping")}


@app.get("/health/db")
def health_db() -> dict[str, Any]:
	dsn = os.getenv("DATABASE_URL")
	if not dsn:
		return {"database": "skipped", "detail": "DATABASE_URL not set"}
	try:
		import psycopg

		with psycopg.connect(dsn) as conn:
			with conn.cursor() as cur:
				cur.execute("SELECT 1")
				one = cur.fetchone()
		return {"database": "ok", "select": one}
	except Exception as e:
		return {"database": "error", "detail": str(e)}


@app.post("/auth/token")
def create_access_token(body: TokenRequest) -> dict[str, str]:
	"""Fail closed until an identity-verifying authentication flow is implemented."""
	raise HTTPException(status_code=501, detail="passwordless_token_stub_disabled")


@app.get("/auth/me")
def auth_me(authorization: str | None = Header(default=None)) -> dict[str, str]:
	if not authorization or not authorization.lower().startswith("bearer "):
		raise HTTPException(status_code=401, detail="missing_bearer")
	raw = authorization[7:].strip()
	try:
		payload = jwt.decode(raw, _jwt_secret(), algorithms=[JWT_ALGORITHM], options={"require": ["exp", "sub"]})
	except jwt.PyJWTError:
		raise HTTPException(status_code=401, detail="invalid_token")
	sub = payload.get("sub")
	if not isinstance(sub, str) or not sub:
		raise HTTPException(status_code=401, detail="invalid_subject")
	return {"email": sub}

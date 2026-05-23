"""AgriNexus FastAPI backend (scaffold)."""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


def _cors_origins() -> list[str]:
	raw = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
	return [o.strip() for o in raw.split(",") if o.strip()]


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


@app.get("/health")
def health() -> dict[str, str]:
	return {"status": "ok"}


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

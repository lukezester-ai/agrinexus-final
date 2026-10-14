# AgriNexus — FastAPI backend (`apps/backend`)

- **Run (local):** from this directory, with venv: `pip install -e .` then `python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`.
- **Docker:** from the repository root, run `docker build -f apps/backend/Dockerfile .`.
- **Core-only Docker:** pass `--build-arg INSTALL_AGRICULTURE=0` to prove the core starts without the optional vertical package.
- **Endpoints:** `GET /health`, `GET /health/db` (needs `DATABASE_URL`).

Copy `.env.example` → `.env` when running outside Docker Compose.

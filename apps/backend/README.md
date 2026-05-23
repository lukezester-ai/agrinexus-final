# AgriNexus — FastAPI backend (`apps/backend`)

- **Run (local):** from this directory, with venv: `pip install -r requirements.txt` then `python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`.
- **Docker:** built by root `docker-compose.yml` service `backend`.
- **Endpoints:** `GET /health`, `GET /health/db` (needs `DATABASE_URL`).

Copy `.env.example` → `.env` when running outside Docker Compose.

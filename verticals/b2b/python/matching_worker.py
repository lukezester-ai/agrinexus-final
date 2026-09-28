"""Privileged matching worker — not an HTTP route.

Polls matching_jobs with FOR UPDATE SKIP LOCKED, then calls
public.run_matching_engine_v1(). Browser and app_user never invoke the engine.

Env: MATCHER_DATABASE_URL (preferred) or DATABASE_URL.
Run from the repo root: python verticals/b2b/python/matching_worker.py
"""

from __future__ import annotations

import os
import time

MAX_ATTEMPTS = 5
STALE_PROCESSING_SECONDS = 15 * 60
POLL_SECONDS = 2
RECOVERY_EVERY = 30
CONNECT_RETRY_SECONDS = 8

CLAIM_SQL = """
WITH picked AS (
    SELECT id
    FROM public.matching_jobs
    WHERE status = 'pending'
      AND attempts < %s
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT 10
)
UPDATE public.matching_jobs AS j
SET status = 'processing',
    started_at = now(),
    attempts = j.attempts + 1
FROM picked
WHERE j.id = picked.id
RETURNING j.id;
"""

RECOVERY_SQL = """
UPDATE public.matching_jobs
SET status = CASE
        WHEN attempts >= %s THEN 'failed'::public.matching_job_status
        ELSE 'pending'::public.matching_job_status
    END,
    last_error = CASE
        WHEN attempts >= %s THEN 'stale processing marked failed'
        ELSE 'stale processing requeued'
    END,
    completed_at = CASE WHEN attempts >= %s THEN now() ELSE completed_at END,
    started_at = CASE WHEN attempts >= %s THEN started_at ELSE NULL END
WHERE status = 'processing'
  AND started_at IS NOT NULL
  AND started_at < now() - (%s * interval '1 second');
"""

COMPLETE_SQL = """
UPDATE public.matching_jobs
SET status = 'completed',
    completed_at = now(),
    last_error = ''
WHERE id = %s;
"""

FAIL_SQL = """
UPDATE public.matching_jobs
SET status = CASE
        WHEN attempts >= %s THEN 'failed'::public.matching_job_status
        ELSE 'pending'::public.matching_job_status
    END,
    last_error = %s,
    started_at = CASE WHEN attempts >= %s THEN started_at ELSE NULL END,
    completed_at = CASE WHEN attempts >= %s THEN now() ELSE completed_at END
WHERE id = %s;
"""


def _dsn() -> str:
    raw = (os.getenv("MATCHER_DATABASE_URL") or os.getenv("DATABASE_URL") or "").strip()
    if not raw:
        raise SystemExit("MATCHER_DATABASE_URL or DATABASE_URL is required")
    return raw


def process_once(conn) -> int:
    n = 0
    with conn.cursor() as cur:
        cur.execute(CLAIM_SQL, (MAX_ATTEMPTS,))
        ids = [row[0] for row in cur.fetchall()]
    conn.commit()
    for job_id in ids:
        n += 1
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT public.run_matching_engine_v1()")
                cur.execute(COMPLETE_SQL, (job_id,))
            conn.commit()
        except Exception as exc:
            conn.rollback()
            err = str(exc)[:2000]
            with conn.cursor() as cur:
                cur.execute(FAIL_SQL, (MAX_ATTEMPTS, err, MAX_ATTEMPTS, MAX_ATTEMPTS, job_id))
            conn.commit()
    return n


def recover_stale(conn) -> None:
    with conn.cursor() as cur:
        cur.execute(
            RECOVERY_SQL,
            (MAX_ATTEMPTS, MAX_ATTEMPTS, MAX_ATTEMPTS, MAX_ATTEMPTS, STALE_PROCESSING_SECONDS),
        )
    conn.commit()


def main() -> None:
    import psycopg

    dsn = _dsn()
    ticks = 0
    conn = None
    print("matching-worker: start (no HTTP; privileged DB only)", flush=True)
    while True:
        try:
            if conn is None or conn.closed:
                conn = psycopg.connect(dsn)
                print("matching-worker: connected", flush=True)
            if ticks % RECOVERY_EVERY == 0:
                recover_stale(conn)
            process_once(conn)
            ticks += 1
            time.sleep(POLL_SECONDS)
        except Exception as exc:
            print(f"matching-worker: {exc}", flush=True)
            if conn is not None:
                try:
                    conn.close()
                except Exception:
                    pass
            conn = None
            time.sleep(CONNECT_RETRY_SECONDS)


if __name__ == "__main__":
    main()

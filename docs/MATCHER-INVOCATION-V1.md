# Matching Engine invocation v1

Status: **enqueue + privileged worker**. Scoring (`009`), RLS, and Radar stay frozen.

**Core is a business decision desk, not a social network.** The user declares Intent / Opportunity. The system matches. The user never runs the algorithm.

## Forbidden

- `EXECUTE` on `run_matching_engine_v1()` for `app_user`, `authenticated`, `anon`
- Browser or `/api/run-matcher` (hidden endpoints included)
- Running the engine inside the user INSERT/UPDATE transaction

## Flow

```
Intent / Opportunity change (matching-relevant fields)
        ↓
SECURITY DEFINER enqueue (identifiers + reason only)
        ↓
matching_jobs
        ↓
Privileged worker (FOR UPDATE SKIP LOCKED)
        ↓
run_matching_engine_v1()
        ↓
business_matches (unique intent+opportunity+engine+version)
        ↓
Radar read model
        ↓
Qualify → Request introduction → Accept → Relationship
```

Triggers enqueue only when the row is matchable (`active` / `open`, visibility confidential|network|public) and a matching field changed: lifecycle, kind, industry, target_markets, visibility, expiry (intents). Headline/summary edits do not enqueue.

`matching_jobs` stores no confidential payload.

## Worker

Not an HTTP handler. From the repo root:

```text
$env:MATCHER_DATABASE_URL="postgresql://postgres.<project_ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"
python verticals/b2b/python/matching_worker.py
```

Use the **Session pooler** (`pooler.supabase.com:5432`), not `db.<project>.supabase.co` (IPv6-only on many Windows hosts) and not a URI with an empty password (`postgres://postgres:@...`).

Identity: prefer `intent_matcher` (read indexes, execute engine, write candidate matches, update jobs). Hosted Supabase often cannot `SET ROLE intent_matcher`; then the worker DSN is a **restricted** postgres role with only those grants — not a general `service_role` for Auth/Storage. Migration 013 also GRANTs `postgres` and `postgres.<project_ref>` pooler logins.

Retries: max 5, then `failed`. Stale `processing` (>15 min) is requeued; jobs already at 5 attempts are marked `failed`. Connection loss does not kill the process — reconnect after 8s.

Existing active intents / open opportunities are backfilled into `matching_jobs` when 013 is applied.

Engine narrowing (`run_matching_engine_v1_for_intent`) is **v2**. Invocation v1 calls the frozen global function.

## Apply

1. SQL Editor: `migrations/013_matching_engine_invocation.sql`
2. Run the worker against that database
3. Compatible pair (same industry, overlapping markets, buy + sell opportunity) → row in `business_matches` → Radar

Existing `agri-food` vs `logistics` rows will not match even with a live worker.

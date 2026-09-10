# Matching Engine v1 — Product Contract

Status: locally validated; hosted staging migration validated; production rollout pending PR review

## Product flow

`Active Intent → Eligible Opportunity → Deterministic Match → Explainable score → Qualification → Introduction`

## Invariants

- Matching reads only the redacted intent and opportunity match indexes.
- The deterministic matcher owns match creation and scoring fields.
- Browser users cannot execute the matcher or insert/update/delete match rows directly.
- Supabase `authenticated` users see matches only when their organization is a party.
- Qualification and introduction actions run through the existing authorization-aware RPC commands.
- Confidential identities remain hidden until the introduction lifecycle permits disclosure.
- Score, confidence, reasons, engine version and provenance remain auditable.
- The production worker fails closed when `CRON_SECRET` or `SUPABASE_SERVICE_ROLE_KEY` is absent.

## Runtime boundary

- `GET /api/cron/matching` is the only scheduled application entry point.
- Vercel authenticates the request with `Authorization: Bearer $CRON_SECRET`.
- The server-only Supabase client invokes `run_matching_engine_v1` as `service_role`.
- `anon`, `authenticated`, `app_user` and `PUBLIC` cannot invoke the matcher.

## Excluded from v1

- AI-generated scoring or explanations.
- Public-market data and agriculture-specific criteria.
- Automatic introductions or contact disclosure.
- Rewriting the existing deterministic score formula.

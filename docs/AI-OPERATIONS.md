# AgriNexus — AI operations

## Endpoints

| Path | Role |
|------|------|
| `POST /api/chat` | LangGraph mesh: orchestrator → runtime agents for analytics, market, weather, crop lifecycle, field monitoring, operations, finance, compliance, sustainability, news, academy, and general conversation. Response includes `lastRoute`. |
| `POST /api/academy-tutor` | Academy pages only; Mistral + Yahoo snapshot for **teaching** (not advice). |

Local `npm run dev` (`scripts/dev-server.mjs`) exposes the same route as Vercel so Academy pages can call the Tutor without a 404.
| `GET /api/market-data` | Cached commodity quotes (Yahoo). Used by Market Intelligence ticker + LLM snapshots. |

## Environment

See root `.env.example`: `MISTRAL_API_KEY`, optional per-agent model overrides, rate limits (`AGN_MESH_RATE_LIMIT_PER_MIN`, `AGN_ACADEMY_RATE_LIMIT_PER_MIN`).

Current `/api/chat` route keys:

- `ANALYTICS_AGENT` → `analyticsAgent`
- `MARKET_AGENT` → `marketAgent`
- `WEATHER_AGENT` → `weatherAgent`
- `CROP_AGENT` → `cropAgent`
- `FIELD_AGENT` → `fieldAgent`
- `OPERATIONS_AGENT` → `operationsAgent`
- `FINANCE_AGENT` → `financeAgent`
- `COMPLIANCE_AGENT` → `complianceAgent`
- `SUSTAINABILITY_AGENT` → `sustainabilityAgent`
- `NEWS_AGENT` → `newsAgent`
- `ACADEMY_AGENT` → `academyAgent`
- `GENERAL_RESPONSE` → `generalAgent`

## Logs

Mesh and academy-tutor emit **one JSON line per event** on stdout (`service`, `event`, timings) for Vercel log drains.

## Fieldlot RAG

- `cd fieldlot && npm run sync:listings` rebuilds listings + semantic index. With `MISTRAL_API_KEY` set, **zero embeddings while chunks exist** fails the script (exit 1).
- Root `npm run check:fieldlot-rag` warns by default; `CHECK_FIELDLOT_RAG_STRICT=1` fails CI on broken index files.

## CI

`.github/workflows/ci.yml` — root typecheck + advisory RAG check; `fieldlot` typecheck + `npm test`.

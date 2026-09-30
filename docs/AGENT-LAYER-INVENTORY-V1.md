# Agent layer inventory v1

Status: **ACCEPTED ARCHITECTURAL FACT**. Parent boundary: `92378f8`.

Accepted as the factual record of the old agricultural agent layer. It is not a public capability claim. Website IA v1 must follow this record and is not closed by this acceptance.

This is not a public-site rewrite and not a Visual/UI gate. `606e08b` and `92378f8` are unchanged. P6 does not start. Agent Layer remains **NOT PUBLIC / NOT CLAIMED**.

The public agents page claims eighteen specialists. The same page defines **19** named cards. Runnable chat code does not implement 19 separate agents.

## What actually runs

`api/chat.ts` is a LangGraph router. An orchestrator picks one route. Each route is a Mistral prompt. None of them place an order, control equipment, or read the frozen finance execution chain.

Routes that attach data:

- `MARKET_AGENT`, `ANALYTICS_AGENT`, and `ACADEMY_AGENT` call `fetchMarketSnapshotForLlm()` — delayed Yahoo quotes for `ZW=F`, `ZC=F`, `ZS=F`, `ZL=F`. The prompt forbids invented prices and trade instructions.
- Every other route is prompt text only.

Separate agriculture code, not the public 19 cards:

- `verticals/agriculture/python/.../agents/crop_expert.py` — placeholder retriever, not a product agent.
- `verticals/agriculture/python/.../agents/risk_weather.py` — placeholder retriever plus an Open-Meteo call with default Sofia coordinates.
- `verticals/agriculture/ai/furrow-agent-tools.ts` — Furrow tools: knowledge search, delayed grain signals, waitlist, web news search. A different surface from `api/chat.ts`.

Proven Universal Business Core modules are not these cards:

| Proven direction | Code | Relation to the 19 cards |
|---|---|---|
| Business Radar | intents, matching, introduction, relationship | Deterministic matching. No LLM agent card. |
| Finance Intelligence | `verticals/finance` market data, screeners, strategy, backtest, paper book | Not the farm `FINANCE_AGENT`. |
| AI Strategy Copilot | `verticals/finance/engine/copilot.py` | Compiles a model candidate into a canonical spec or rejects it. Does not run a backtest, touch a paper book, or place an order. |
| Risk & Governance | risk policy, evaluation, human approval, audit | Not the compliance or carbon prompt. |
| Execution Safety | authorization through observed result, stop at `92378f8` | Not the marketing “autonomy ladder” or its “kill switch”. |

## The 19 public cards

“Exists” means a dedicated implementation of that card. A shared prompt that mentions the name is not a separate agent.

| Card | Code | Real function | Module it can sit under |
|---|---|---|---|
| Planning `PLN` | No separate agent. Mentioned inside `CROP_AGENT`. | Prompt: rotations, varieties, checklists. No season plan is stored. | Not a live UBC module. Conceptual research role only. |
| Seeding `SED` | No separate agent. Same `CROP_AGENT`. | Prompt. Does not issue work orders. | Not a live UBC module. |
| Irrigation `IRR` | No separate agent. The word routes to `WEATHER_AGENT`. | Prompt. Does not read sensors or control irrigation. | Not a live UBC module. |
| Nutrition `NUT` | No separate agent. Same `CROP_AGENT`. | Prompt. Does not read soil samples or export maps. | Not a live UBC module. |
| Satellite `SAT` | No separate agent. Same `FIELD_AGENT`. | Prompt says it has not seen live imagery. No Sentinel/Landsat client on this route. | Not a live UBC module. |
| Disease `DIS` | No separate agent. Same `FIELD_AGENT`. | Prompt. No computer-vision diagnosis. | Not a live UBC module. |
| Weed scout `WDS` | No separate agent. Same `FIELD_AGENT`. | Prompt. No spray maps. | Not a live UBC module. |
| Weather sentry `WTR` | `WEATHER_AGENT` in `api/chat.ts`. | Prompt. Must not invent temperatures or dated forecasts. | Not a live UBC module. The Python weather file is a separate placeholder. |
| Fleet `FLT` | No separate agent. Same `OPERATIONS_AGENT`. | Prompt. The prompt says not to pretend to execute. | Not a live UBC module. |
| Labor `LAB` | No separate agent. Same `OPERATIONS_AGENT`. | Prompt. No workforce records. | Not a live UBC module. |
| Inventory `INV` | No separate agent. Same `OPERATIONS_AGENT`. | Prompt. No stock ledger. | Not a live UBC module. |
| Market `MKT` | `MARKET_AGENT` in `api/chat.ts`. | Explains a delayed Yahoo futures snapshot. Does not hedge or send an order. | Adjacent to research language only. It is not `verticals/finance`. |
| News `NWS` | `NEWS_AGENT` in `api/chat.ts`. | Prompt. This endpoint states it has no live news access. | Not a live UBC module. Furrow’s `search_web_news` is a different tool. |
| Compliance `CMP` | `COMPLIANCE_AGENT` in `api/chat.ts`. | Prompt checklists. Does not file subsidies or certify GAP. | Not Risk & Governance. That layer is the finance policy, evaluation, and human approval chain. |
| Carbon `CO2` | `SUSTAINABILITY_AGENT` in `api/chat.ts`. | Prompt. Does not calculate a footprint or issue credits. | Not a live UBC module. |
| Finance `FIN` | `FINANCE_AGENT` in `api/chat.ts`. | Prompt about field P&L. Does not read `verticals/finance`. | Must not be described as Finance Intelligence or Execution Safety. |
| Orchestrator `ORC` | `orchestrator` in `api/chat.ts`. | Chooses one chat route. Does not authorize or dispatch. | Internal router for the agriculture chat, not the UBC decision layer. |
| Conversation `CNV` | `GENERAL_RESPONSE` in `api/chat.ts`. | General prompt. No voice product. | Internal chat entry, not a public product direction. |
| Learning `LRN` | No federated-learning agent. The word “learn” routes to `ACADEMY_AGENT`. | Academy tutor prompt plus the same delayed snapshot. No model update across farms. | Legacy Academy. Out of the six public directions. |

## Routes that are not on the card list

| Route | Real function | Public claim allowed |
|---|---|---|
| `ANALYTICS_AGENT` | Explains the same delayed snapshot. No buy/sell instructions. | Research explanation only. Not a nineteenth product. |
| `ACADEMY_AGENT` | Teaching prompt. | Legacy Academy, not one of the six directions. |

## Consequence for the public site

The sentence “18 Specialized AI Agents” is not yet a fact about the running system. Publishing the 19 farm names, the autonomy levels, or a kill switch on those cards would restore claims the code does not perform.

A control-room home can show the six proven directions and STOP. An agent layer can be described as internal roles only where a module exists: Radar matching, finance research and paper paths, copilot validation, risk governance, and the blocked execution boundary. Those are not the 19 agriculture cards.

Specific agent names stay off the public navigation until a later specification assigns each name to a module that exists, or marks it as a future role that is not implemented.

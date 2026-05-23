# AgriNexus 🌾

**An operating system that senses, thinks, acts.**

AgriNexus is a complete infrastructure for modern farming. It replaces the traditional "black box AI" with a transparent, explainable ecosystem of specialized agents that help farmers make data-driven decisions.

## Project Structure & Core Pages

### 1. Agents (`index.html`)
**"Eighteen specialists. One thinking farm."**
The system is built on a strong metaphor: 18 distinct specialists forming a coordinated team, orchestrated by a central intelligence.
- **5 Families:** Crop Lifecycle, Monitoring & Detection, Operations, Business & Compliance, Meta Layer.
- **Autonomy Levels:** Trust is built on control. The system ranges from L1 (Advisor) to L4 (Autonomous).
- **Transparency:** Over 340 decisions a day, 100% auditable.

### 2. Market Intelligence (`market-intelligence.html`)
**"Trade your harvest like a hedge fund."**
A Bloomberg-meets-Stripe terminal aesthetic, designed for farmers.
- **Live Ticker:** Real-time prices for Wheat, Corn, Sunflower, Rapeseed, Barley, and Soy.
- **The Engine:** Forecast targets combined with the farmer's break-even metrics to show potential profit.
- **Signal Stack:** Synthesizes news, satellite data, FX rates, and USDA reports into an actionable Orchestrator Synthesis (e.g., "+2.0% bullish bias").
- **Optimal Selling Window:** A clear visualization (Sell Now vs. Sell Sep vs. Hold) proving ROI (+€18/tonne).

### 3. Platform Architecture (`platform.html`)
**"Three layers, one nervous system."**
A transparent look at how data flows through the system.
- **01 SENSE:** Satellites (10m/px), IoT Mesh, Market Feeds, Field Reports.
- **02 THINK:** Unified Data Lake, the Agent Mesh (LangGraph), Model Library.
- **03 ACT:** Daily Briefings, Autonomous Actions, Mobile & Web UI.
- **Integrations:** Sits seamlessly on top of existing setups (John Deere, Trimble, Sentinel Hub, Rabobank, etc.).
- **Foundation:** Built on Data Sovereignty (EU GDPR), Auditable Decisions (SOC 2), and Developer Access.

### 4. Academy (`academy.html`)
**"A library that grows with you."**
A warm, educational space operating on a different emotional register—designed for learning, not just marketing.
- **Learning Paths:** Structured curriculum for modern farming.
- **Field Notes Podcast:** Real stories from real farmers (e.g., "The day I stopped guessing the market").
- **Farmer's Table Community:** A living pulse of peer-to-peer support, alpha sharing, and success stories.
- **Academy Tutor (implemented):** On `academy.html` / `ru/academy.html`, the **Ask the Academy Tutor** panel calls `POST /api/academy-tutor`. It uses Mistral plus a **delayed Yahoo Finance snapshot** (same family as `/api/market-data`) only as **teaching context**, not trading advice.

### 5. Dashboard (`dashboard.html`)
**The Command Center.**
The actual product from the inside. A calm, highly functional UI where the farmer starts their morning with a cup of coffee. It transitions the user from learning and exploring into executing and managing their farm operations.

## Implementation vs. product story

- **“18 specialists”** on `agents.html` is a **design metaphor** for the five agent families and autonomy levels. In this repository, the **executable** agent mesh is the **LangGraph** flow in `api/chat.ts` (orchestrator → **market**, **weather**, **academy**, **general** agents) plus the separate **`POST /api/academy-tutor`** endpoint for the Academy pages.
- **Market quotes** in the mesh and Academy use **Yahoo Finance** (delayed); the LLM must **not invent** prices when the snapshot is present (see `api/lib/market-snapshot.ts` and `api/lib/agrinexus-policy.ts`).
- **Fieldlot** (subfolder) has its own chat + RAG pipeline; `fieldlot/scripts/sync-gov-listings.ts` **fails the build** if `MISTRAL_API_KEY` is set but the semantic RAG index has **chunks and zero embeddings** (misconfigured embed step).

## CI

GitHub Actions: `.github/workflows/ci.yml` — root `npm run typecheck`, advisory `npm run check:fieldlot-rag` (set `CHECK_FIELDLOT_RAG_STRICT=1` to hard-fail when the committed Fieldlot index has no vectors), and `fieldlot` `npm test`.

Operator notes: `docs/AI-OPERATIONS.md`.

---
*Every article peer-reviewed by working agronomists and traders. Always free. No vendor lock-in. Open standards, your data, your call.*

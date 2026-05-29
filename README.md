# AgriNexus 🌾

**An operating system that senses, thinks, acts.**

Канонично GitHub репо (Academy / монорепо): **[roxsonltd-droid/ai-agri-academy](https://github.com/roxsonltd-droid/ai-agri-academy)**.

AgriNexus is a complete infrastructure for modern farming. It replaces the traditional "black box AI" with a transparent, explainable ecosystem of specialized agents that help farmers make data-driven decisions.

## Quick links

| Topic | Where |
|--------|--------|
| **GitHub (canonical repo)** | [github.com/roxsonltd-droid/ai-agri-academy](https://github.com/roxsonltd-droid/ai-agri-academy) |
| **Локален корен (канонично, това копие)** | `C:\Users\expre\OneDrive\Desktop\project\agrinexus-final-main` — виж [`docs/CANONICAL-WORKSPACE-BG.md`](docs/CANONICAL-WORKSPACE-BG.md) и `Open-Academy-Terminal.cmd` |
| **Архитектура & целеви стек** | [`docs/TARGET-ARCHITECTURE.md`](docs/TARGET-ARCHITECTURE.md) |
| **Local dev** (Next + FastAPI + Expo + Docker) | [`docs/LOCAL-DEV.md`](docs/LOCAL-DEV.md) |
| **Web app** | [`apps/web/README.md`](apps/web/README.md) |
| **Mobile** | [`apps/mobile/README.md`](apps/mobile/README.md) |
| **Backend (Python)** | [`apps/backend/README.md`](apps/backend/README.md) |
| **Академия (продукт + навигация)** | [`docs/ACADEMY_PRODUCT_VISION.md`](docs/ACADEMY_PRODUCT_VISION.md), [`docs/ACADEMY_ARCHITECTURE.md`](docs/ACADEMY_ARCHITECTURE.md), [`docs/DESIGN-SYSTEM.md`](docs/DESIGN-SYSTEM.md) (§ Next.js Academy) |

**Auth (Supabase):** когато `apps/web` е конфигуриран с `@supabase/ssr`, браузърният клиент и middleware държат сесията; локализиран вход: `/login` и `/bg/login` при зададени `NEXT_PUBLIC_SUPABASE_*`.

**AI Tutor / LangGraph:** при наличен backend — `POST /api/tutor/graph` и свързаните маршрути в `docs/BACKEND_API.md` (ако са включени в това копие).

**AI кошче:** временни чернови, фрагменти и еднократни артефакти от работа с ИИ — папка **`ai-trash/`** (съдържанието е в `.gitignore`, виж `ai-trash/README.md`). Правило за агентите: `.cursor/rules/ai-trash.mdc`.

**Windows + кирилица в пътя:** ако имаш и `Desktop\проект\…` и `Desktop\project\…`, лесно се работи върху „грешното“ копие. Виж **`docs/WORKSPACE-CYRILLIC-PATH-BG.md`** и скрипта **`scripts/windows/link-cyrillic-desktop-folder.ps1`** (junction към ASCII репото по подразбиране).

**Графичен слой:** споделени стилове в **`styles/agri-market-shared.css`** + **`styles/agri-marketing-supplement.css`** за начална/агенти; описание и таблица: **`docs/DESIGN-SYSTEM.md`**.

## DevEx (монорепо `apps/*`)

- **Pre-commit:** [Husky](https://typicode.github.io/husky/) + [lint-staged](https://github.com/lint-staged/lint-staged) — след `npm ci` в корена ESLint за стейджнати `apps/web/**/*.{ts,tsx}` (ако е конфигурирано).
- **CI:** `.github/workflows/ci.yml` — според съдържанието в това копие (typecheck, web, mobile, backend, fieldlot).
- **Секрети:** коренов [`.env.example`](.env.example) и `docs/LOCAL-DEV.md`.

## Project Structure & Core Pages

### 1. Academy home (`index.html`, `bg/index.html`)
**Public site is Academy-first:** short entry with links to the full **library** (`academy.html` / `bg/academy.html`), a **lab** section (safe experiments, Tutor anchor), and a **compare** block (two mental models + self-check—no “correct” click). The earlier agent marketing mesh lives on **`agents.html`** (archive).

### 2. Market Intelligence (`market-intelligence.html`)
**"Trade your harvest like a hedge fund."**
A Bloomberg-meets-Stripe terminal aesthetic, designed for farmers. Styles live in **`styles/agri-market-shared.css`** (shared with **`analytics.html`**).
- **Live Ticker & chart:** `npm run dev` then open the page — data comes from **`/api/market-data`** and **`/api/market-history`** (delayed Yahoo CBOT symbols `ZW=F` / `ZC=F`). Plain static hosting (`npm run serve`) serves files only; APIs will not run.
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
- **Academy Tutor (implemented):** On `academy.html` / `bg/academy.html`, the **Ask the Academy Tutor** panel calls `POST /api/academy-tutor`. It uses Mistral plus a **delayed Yahoo Finance snapshot** (same family as `/api/market-data`) only as **teaching context**, not trading advice.
- **Product & architecture docs:** `docs/ACADEMY_PRODUCT_VISION.md` (визия, MVP, фази), `docs/ACADEMY_ARCHITECTURE.md` (потокове и файлове в репото).
- **Roadmap on the page:** MVP highlights on `academy.html` and `bg/academy.html`, localized through `scripts/academy-hub.js`.
- **„AI фермерски мозък“:** same pages — title plus four short lines (teach → analyze → decide → automate); details in `docs/ACADEMY_PRODUCT_VISION.md` §3 and `docs/ACADEMY_ARCHITECTURE.md` §2.

### 5. Dashboard (`dashboard.html`)
**The Command Center.**
The actual product from the inside. A calm, highly functional UI where the farmer starts their morning with a cup of coffee. It transitions the user from learning and exploring into executing and managing their farm operations.

## Implementation vs. product story

- **“18 specialists”** on **`agents.html`** is a product map for agent families and autonomy levels. In this repository, the **executable** agent mesh is the **LangGraph** flow in `api/chat.ts` (orchestrator → analytics, market, weather, crop, field monitoring, operations, finance, compliance, sustainability, news, academy, and general agents) plus the separate **`POST /api/academy-tutor`** endpoint for the Academy pages.
- **Market quotes** in the mesh and Academy use **Yahoo Finance** (delayed); the LLM must **not invent** prices when the snapshot is present (see `api/lib/market-snapshot.ts` and `api/lib/agrinexus-policy.ts`).
- **Fieldlot** (subfolder) has its own chat + RAG pipeline; `fieldlot/scripts/sync-gov-listings.ts` **fails the build** if `MISTRAL_API_KEY` is set but the semantic RAG index has **chunks and zero embeddings** (misconfigured embed step).

## Marketing site + Yahoo APIs (repo root)

```bash
npm install
npm run dev
```

Serves `http://127.0.0.1:3456` with static HTML/CSS plus **`/api/market-data`**, **`/api/market-history`**, **`POST /api/chat`** (LangGraph mesh, including **AI Analytics** / `ANALYTICS_AGENT`), waitlist, etc. **`market-intelligence.html`**, **`analytics.html`**, and RU mirrors load charts/ticker through these routes — use **`npm run dev`**, not **`npm run serve`** (static-only, no APIs).

## Mobile app — React Native + Expo

Кодът е в **`apps/mobile`**: **Expo Router**, TypeScript, EN/БГ превключвател, вход към FastAPI и каталог академия към Next (`/api/mobile/courses`). От корена на репото:

```bash
npm run dev:mobile
```

Пълни инструкции (`.env`, Android `10.0.2.2`, заедно с `dev:web` и backend): **`apps/mobile/README.md`**.

## Target stack (roadmap)

Продуктов слой (бъдеща фаза): **Next.js** (frontend), **Python + FastAPI** (backend), **PostgreSQL** (OLTP), **vector DB** (AI memory), **Docker** automation, **VPS** → по-късно **Kubernetes**. Пълна таблица и роли: **`docs/TARGET-ARCHITECTURE.md`**. Скелет за локална работа: **`docs/LOCAL-DEV.md`** (`apps/web`, `apps/backend`, `apps/mobile`, `docker-compose.yml`).

## CI

GitHub Actions: `.github/workflows/ci.yml` — root `npm run typecheck`, advisory `npm run check:fieldlot-rag` (set `CHECK_FIELDLOT_RAG_STRICT=1` to hard-fail when the committed Fieldlot index has no vectors), and `fieldlot` `npm test`.

Operator notes: `docs/AI-OPERATIONS.md`.

---
*Every article peer-reviewed by working agronomists and traders. Always free. No vendor lock-in. Open standards, your data, your call.*

# Target platform architecture (AgriNexus)

Целева архитектура за продуктов слой: **Next.js (frontend)**, **Python + FastAPI (backend)**, **PostgreSQL + vector store**, **Docker**, **VPS** с път към **Kubernetes**.

## Stack overview

| Тип / слой | Технология |
|-------------|------------|
| **Frontend** | **Next.js** (SSR/SSG, App Router, UI слой, форми, dashboards) |
| **Backend** | **Python + FastAPI** (REST/WebSocket, бизнес логика, интеграции, AI оркестрация) |
| **Нормални данни** | **PostgreSQL** (потребители, стопанства, сделки, конфигурации, audit) |
| **AI memory / RAG** | **Vector DB** (embeddings + similarity search; варианти: `pgvector` в същия Postgres, или отделен Qdrant / Weaviate / Pinecone — избор по SLA и обем) |
| **PostgreSQL hosting** | Managed Postgres (Neon, Supabase, RDS, …) или **Docker** на **VPS** |
| **Automation** | **Docker** (images за API, workers, migrations), CI/CD (build, test, deploy) |
| **UX** | Next.js компоненти + дизайн токени; съгласуваност с маркетинг страниците в този repo където е уместно |
| **Business logic** | FastAPI services (domain modules), background jobs (Celery/RQ/Arq или managed queues) |
| **Runtime (фаза 1)** | **VPS** (един или малък pool от машини + reverse proxy) |
| **Runtime (по-късно)** | **Kubernetes** (HA, autoscaling, multi-region — когато натоварването и екипът оправдават сложността) |

## Роли по слой

- **Next.js**: публичен и логнат UI, BFF-опции (Server Actions / route handlers) само където няма да дублирате домейн логиката — основната логика остава във FastAPI.
- **FastAPI**: авторизация, валидации, домейн правила, AI pipelines, webhooks, batch.
- **PostgreSQL**: източник на истина за структурирани данни; миграции (Alembic/Flyway).
- **Vector DB**: памет за агенти (chunks + embeddings), отделно от OLTP схемата или като разширение (`pgvector`).

## Наблюдения за текущия repo (`agrinexus-final-main`)

Днес проектът е предимно **статичен сайт** (HTML) + **Vercel Functions** под `api/` (TypeScript). Документът описва **целевата** архитектура за следваща фаза; миграцията може да върви постепенно (напр. първи read-only API към Postgres, после Next.js app за dashboard).

## Имплементиран скелет (repo)

- **`apps/web`** — Next.js (frontend)
- **`apps/backend`** — Python + FastAPI
- **`docker-compose.yml`** — PostgreSQL (**pgvector/pgvector:pg16**) + backend image
- **`infra/docker/init-db.sql`** — `CREATE EXTENSION vector`
- Инструкции за пускане: **`docs/LOCAL-DEV.md`**

## Следващи стъпки (по избор)

1. Репо структура: `apps/web`, `apps/backend`, `infra/docker`, `infra/k8s` (по-късно).
2. Договор между фронтенд и бекенд: OpenAPI от FastAPI → генериран клиент за TS.
3. Локален dev: `docker compose` с Postgres (+ pgvector) и API — виж **`docs/LOCAL-DEV.md`**.

За оперативни AI бележки по текущия deployment виж също `docs/AI-OPERATIONS.md`.

# AgriNexus — Next.js app (`apps/web`)

- **Dev:** `npm install` then `npm run dev` (port **3000**).
- **Routes:** `/login`, `/academy` (5 курса), `/academy/course/[slug]`, `/academy/course/[slug]/test` (финален тест), `/academy/lecturer`, `/academy/lab`.
- **API:** set `NEXT_PUBLIC_API_URL` (see `.env.example`) to the FastAPI origin, default `http://127.0.0.1:8000`.
- **Stack:** Next.js App Router + Tailwind + TypeScript.

Full stack (Postgres + FastAPI + this app): **`docs/LOCAL-DEV.md`**.

**Vercel:** production трябва да ползва **Root Directory = `apps/web`**. Кореновият `vercel.json` в repo-то билдва само статичен сайт — виж секцията *„Vercel — защо на production…“* в **`docs/LOCAL-DEV.md`**.

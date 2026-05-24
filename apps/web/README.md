# AgriNexus — Next.js app (`apps/web`)

- **Dev:** `npm install` then `npm run dev` (port **3000**).
- **Routes (skeleton):** `/login` (auth placeholder), `/academy` (course list), `/academy/course/[slug]` (e.g. `market-literacy`, `sense-think-act`).
- **API:** set `NEXT_PUBLIC_API_URL` (see `.env.example`) to the FastAPI origin, default `http://127.0.0.1:8000`.
- **Stack:** Next.js App Router + Tailwind + TypeScript.

Full stack (Postgres + FastAPI + this app): **`docs/LOCAL-DEV.md`**.

# AgriNexus mobile (Expo)

This app uses [Expo Router](https://docs.expo.dev/router/introduction/) (routes under `app/`) and TypeScript. It lives next to `apps/web` (Next.js).

## Screens

| Route | Description |
|-------|-------------|
| `/` | Home — shortcuts to Login & Academy |
| `/login` | Вход: `POST` към FastAPI `/auth/token`, запис на JWT (SecureStore / AsyncStorage на web) |
| `/academy` | Каталог: `GET` към Next `/api/mobile/courses` (+ опционален `Authorization: Bearer`); при грешка — вграден `lib/courses.ts` |
| `/academy/[slug]` | Детайл за курс — същият източник/кеш като списъка |

Header **EN / БГ** toggles copy for all screens.

## Environment (copy `.env.example` → `.env`)

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_WEB_ORIGIN` | Next origin **without** `/en` prefix, e.g. `http://127.0.0.1:3000`. Android emulator → host machine: `http://10.0.2.2:3000`. |
| `EXPO_PUBLIC_BACKEND_URL` | FastAPI, e.g. `http://127.0.0.1:8000`. |

Run **Next** (`apps/web`) and **FastAPI** (`apps/backend`) while testing login + live catalog:

```bash
# terminal A — from repo root or apps/web
npm run dev:web

# terminal B
cd apps/backend && pip install -r requirements.txt && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Optional: set the same `JWT_SECRET` in `apps/backend/.env` for production-like signing (defaults to a dev string if unset).

## Auth flow (dev stub)

1. User enters email on `/login` → mobile calls `POST {EXPO_PUBLIC_BACKEND_URL}/auth/token` → receives JWT.
2. Token + email stored on device; `GET {EXPO_PUBLIC_BACKEND_URL}/auth/me` confirms subject.
3. Academy requests call Next `GET /api/mobile/courses` with `Authorization: Bearer <token>` when logged in. Next verifies the token by calling backend `GET /auth/me`. Catalog remains **public** without a token; invalid Bearer returns **401**.

## Run

From the monorepo root:

```bash
npm run dev:mobile
```

Or from this folder:

```bash
npm install
npm run start
```

Then press `a` (Android emulator), `w` (web), or scan the QR code with **Expo Go** on a physical device.

- **iOS simulator** requires macOS (`npm run ios`).
- **Android** needs Android Studio / emulator or a device with USB debugging (`npm run android`).

## Connect to the web API

Point `fetch` / `axios` at your Next dev server, e.g. `http://<your-LAN-IP>:3000`, and ensure CORS allows the mobile origin if you call browser-based web builds. For native apps, CORS does not apply to `fetch` from the device.

## Docs

- [Expo Router](https://docs.expo.dev/router/introduction/)
- [React Native](https://reactnative.dev/docs/getting-started)

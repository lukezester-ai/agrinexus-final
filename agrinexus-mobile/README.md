# AgriNexus Mobile (Expo)

React Native + Expo starter — табло, полета, настройки. Споделя Supabase с уеб приложението (`agrinexus-final-main`).

## Старт

```bash
cd agrinexus-mobile
npm install
npx expo start
```

Сканирайте QR с [Expo Go](https://expo.dev/go).

## Supabase (по избор)

```bash
cp .env.example .env
```

Попълнете `EXPO_PUBLIC_SUPABASE_URL` и `EXPO_PUBLIC_SUPABASE_ANON_KEY` (legacy anon JWT `eyJ…`).

## Структура

- `src/screens/` — Dashboard, Fields, Settings, Login (stub)
- `src/components/` — StatCard, AlertCard, WeatherCard
- `src/data/` — демо данни (MVP)
- `src/services/supabase.js` — клиент

## Следващи стъпки

- Supabase login (същият API като `/api/auth-signin` на уеб)
- Weather API, карта, push, AI

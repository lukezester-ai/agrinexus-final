# AgriNexus Mobile (Expo) — ready to run

## Старт

```bash
cd agrinexus-mobile
npm install
npx expo start
```

Сканирайте QR с **Expo Go** на телефона.

## Структура

```
src/
 ├── screens/     Dashboard, Fields, Settings
 └── data/        fields.js (демо)
```

Опционално: `src/services/supabase.js` + `.env` за бъдещ login (същият Supabase като уеб).

## Следващи upgrade-и

Login · Supabase DB · Weather API · AI · GPS карта · Push · Satellite

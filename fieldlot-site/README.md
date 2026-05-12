# Fieldlot — самостоятелен лендинг

Този пакет **не** зависи от AgriNexus, Rekolto или AgriMarket. Собствен Vite сървър и малък Node API за чат и форма за ранен достъп.

## Старт

```bash
cd fieldlot-site
npm install
npm run dev
```

- Сайт: [http://127.0.0.1:5174](http://127.0.0.1:5174) (Vite проксира `/api` към API порта по-долу)
- API: `FIELDLOT_API_PORT` (по подразбиране **8789**), само `127.0.0.1`

## `.env` (пример)

Виж `.env.example`. Най-малко за AI чат един от:

- `MISTRAL_API_KEY`, или
- `OPENAI_API_KEY`, или
- `OLLAMA_BASE_URL` (+ по желание `OLLAMA_MODEL`)

За изпращане на заявки от формата по имейл (Resend):

- `RESEND_API_KEY`
- `RESEND_FROM` (верифициран подател в Resend)
- `FIELDLOT_INBOX_EMAIL` (къде да пристигат заявките)

Локално записване на заявки (без имейл): `FIELDLOT_STORE_LEADS=1` → `.local/fieldlot-leads.jsonl`.

## Build (статично)

```bash
npm run build
```

Резултатът е в `dist/`. Забележка: без отделен хост за API, чатът и формата към `/api/*` няма да работят на чист статичен хостинг — нужен е сървър или сървърless функции според твоя deploy.

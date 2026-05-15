# Resend + деплой към Vercel (SIMA)

Кратък ред на действията: домейн в Resend → ключ и `MAIL_FROM` → качване на проекта във Vercel → копиране на environment variables → deploy → тест на форми и чат.

## 1) Resend

1. Регистрация на [resend.com](https://resend.com).
2. **Domains** → добавете домейна си (напр. `agrinexus.eu.com`) и добавете DNS записите, които Resend показва (SPF/DKIM и т.н.), докато статусът стане верифициран.
3. **API Keys** → създайте ключ с права за изпращане — това е **`RESEND_API_KEY`** (не го споделяйте в чат или в Git).
4. **`MAIL_FROM`** трябва да използва адрес от **верифицирания домейн**, например:
   - `SIMA <noreply@agrinexus.eu.com>`
   - или само `noreply@agrinexus.eu.com` ако приема вашият формат в Resend.

5. **`MAIL_TO`** (или `CONTACT_TO_EMAIL`) — към кой пощенски ящик да пристигат контактът и регистрациите (напр. `info@agrinexus.eu.com`). Стойността може да е същият имейл като пощата, която реално отваряте.

Без `RESEND_API_KEY` **и** валиден `MAIL_FROM`, приложението приема формите, но **няма да изпраща имейл** — в UI ще видите съобщение за конфигурация на сървъра.

## 2) Локален тест (по желание)

В `.env` (копие от `.env.example`):

```env
RESEND_API_KEY=re_...
MAIL_FROM=SIMA <noreply@вашият-домейн.com>
MAIL_TO=info@agrinexus.eu.com
OPENAI_API_KEY=sk-...
```

Рестарт на `npm run dev`, после тест от контакт форма / регистрация — имейлът трябва да пристигне в `MAIL_TO`.

## 3) Vercel

1. Качете репозиторито в GitHub/GitLab или архивирайте проекта — **Import** в [vercel.com](https://vercel.com).
2. Vercel обикновено разпознава настройките от **`vercel.json`**: `npm run build`, изход **`dist`**, API от папка **`api/`**.
3. В **Settings → Environment Variables** добавете поне:

   | Име | Бележка |
   |-----|---------|
   | `OPENAI_API_KEY` | За AI чата |
   | `RESEND_API_KEY` | От Resend |
   | `MAIL_FROM` | Верифициран изходящ адрес |
   | `MAIL_TO` | Входяща поща за лидове |
   | `MARKET_QUOTES_PROVIDER` | Напр. `stooq` или `demo` — виж `.env.example` |

   По избор: `AGRI_STORE_LEADS`, S3/R2 за качване на файлове, и др. от `.env.example`.

4. Залепете стойностите за **Production** и при нужда за **Preview** (за PR тестове).
5. **Deploy**. Ако сте задавали ръчно **Build Command** `vite build` в настройките на проекта, премахнете го — да се ползва **`npm run build`** от `vercel.json` /дефолт скрипт).

## 4) След deploy

- Отворете продукционния URL → пробвайте **чат** (наличен `OPENAI_API_KEY`).
- Изпратете **контакт** и **регистрация** — проверете входящата поща на `MAIL_TO`.
- При грешка от Resend (напр. неверен `from`), формата може да върне грешка с текст от API — вижте **Functions → Logs** във Vercel за конкретната функция (`api/contact` или `api/register-interest`).

## 5) Често срещани проблеми

| Симптом | Направление |
|--------|-------------|
| „Имейлът не е изпратен“ в UI | Липсват `RESEND_API_KEY` или `MAIL_FROM` в env на Vercel (или Preview без тези променливи). |
| Resend отказва изпращане | Домейнът в `MAIL_FROM` не е верифициран в Resend или форматът на `MAIL_FROM` е грешен. |
| Чатът не отговаря | Липсва `OPENAI_API_KEY` в средата на Vercel за този deployment. |

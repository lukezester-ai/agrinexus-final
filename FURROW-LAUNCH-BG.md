# Furrow Launch — безплатно публикуване (EN / RU)

**Цел:** live waitlist сайт за **$0 хостинг** (домейнът по избор ~$15/год).  
**Пълен продукт:** виж техническото задание — Data Engine, CMS, платени планове (Фаза 2+).

---

## Какво покрива този launch vs. ТЗ v1.0

| Launch (сега, $0) | ТЗ Фаза 1–3 (по-късно) |
|-------------------|------------------------|
| Статичен сайт + waitlist | PostgreSQL, scrapers, AI pipeline |
| EN / RU превключвател | Auto-detect + `/en/` `/ru/` URL |
| Примерен article mockup | Реални статии от Editorial CMS |
| Mailchimp до 500 абоната | Newsletter + paywall + Stripe |

---

## GitHub + Vercel (препоръчано) — repo **roxson**

**Не** използвай погрешен Git root (напр. цял монорепо) като Vercel **Root Directory** за Furrow. Публикувай от repo **`roxson`**, с файловете в **неговия корен**.

1. Качи съдържанието на тази папка в **https://github.com/…/roxson** (файловете в **корена** на repo-то).
2. Vercel → New Project → Import **roxson** → Root Directory = **`.`**
3. Env: `MISTRAL_API_KEY`, `RESEND_*`, `FURROW_INBOX_EMAIL`
4. Push в **roxson** → автоматичен deploy

---

## Файлове в тази папка

Структурата е за **корена на repo-то** (standalone `roxson` / този clone). Ако същите файлове съществуват и като копие под `furrow-marketing/` в друг монорепо, за live deploy копирай **съдържанието** в корена на `roxson`.

```text
repo-root/
  index.html              ← landing + waitlist
  api/                    ← Vercel serverless (чат, waitlist, сигнали)
  server/                 ← споделена TypeScript логика
  article/sample.html     ← примерна статия (демо)
  styles/furrow.css
  scripts/i18n.js         ← EN / RU
  scripts/i18n-strings.js
  scripts/waitlist.js     ← Mailchimp (конфигурирай)
```

---

## Стъпка 0 — Локален преглед (безплатно)

```bash
# от корена на repo-то (където е package.json). В monorepo: cd furrow-marketing
cp .env.example .env    # MISTRAL_API_KEY + RESEND_* (по избор)
npm install
npm run dev
```

Отвори **http://127.0.0.1:3456** → EN/RU, **жив ticker** (CBOT), waitlist, **AI Analyst**.

Само статичен HTML (без API): `npx --yes serve .` — ticker и чатът няма да работят.

---

## Стъпка 1 — Хостинг $0 (Cloudflare Pages)

1. [cloudflare.com](https://cloudflare.com) → безплатен акаунт  
2. **Workers & Pages** → **Create** → **Pages** → **Upload assets**  
3. Качи **съдържанието на корена** на сайта (архив без `node_modules`). В monorepo това е съдържанието на `furrow-marketing/`, не целият monorepo.  
4. Сайтът е live на `https://furrow-site.pages.dev` (или подобно) — **без домейн, без плащане**

По-късно: **Custom domain** → `furrowmarkets.com` (ако го купиш).

---

## Стъпка 2 — Waitlist $0 (Mailchimp Free)

До **500 контакта** — безплатен план.

1. [mailchimp.com](https://mailchimp.com) → Free  
2. Audience → **Furrow Waitlist**  
3. Field **Interest** → tag `MMERGE2` (dropdown: grains, livestock, …)  
4. Signup forms → Embedded → копирай **form action URL** и **hidden field** `b_...`  
5. В `scripts/waitlist.js`:

```javascript
const MAILCHIMP_URL = 'https://....list-manage.com/subscribe/post?u=...&id=...';
const MAILCHIMP_HIDDEN_NAME = 'b_...';
```

6. Качи отново на Cloudflare Pages

**Алтернатива $0:** [Formspree](https://formspree.io) (50/мес), [Brevo](https://brevo.com) (300 emails/ден).

---

## Стъпка 3 — Домейн (по избор, ~$12–15/год)

Само ако искаш `furrowmarkets.com` вместо `.pages.dev`:

1. Namecheap / Porkbun → купи `furrowmarkets.com`  
2. Cloudflare → Add site → смени nameservers при регистратора  
3. Pages → Custom domains → `furrowmarkets.com` + `www`

**Без домейн** launch-ът е напълно валиден на `*.pages.dev`.

---

## Двуезичност (EN / RU)

- Превключвател горе вдясно; изборът се пази в `localStorage`  
- Руски по подразбиране, ако браузърът е `ru`  
- В ТЗ Фаза 3: URL `/en/`, `/ru/`, IP detect, отделни native статии

Редакция на текстове: `scripts/i18n-strings.js`

---

## Следващи стъпки по ТЗ (когато имаш 100+ waitlist)

1. **Фаза 1:** DB schema, backend скелет, CMS queue  
2. **Фаза 2:** Разшири Furrow ingest в `market-data/` (USDA, FAO, Зерно Онлайн…)  
3. **Фаза 3:** Next.js/Astro public site, реални статии, SEO, beta  
4. **Фаза 4:** Stripe — Free / Pro $39 / Premium $149  

---

## Бърз checklist

- [ ] Статичният сайт от **корена на Furrow repo-то** качен на Cloudflare Pages (или Vercel за API + ticker)  
- [ ] EN / RU работят  
- [ ] Mailchimp URL в `waitlist.js`  
- [ ] Тестова заявка в Mailchimp Audience  
- [ ] (По избор) домейн `furrowmarkets.com`  
- [ ] LinkedIn / лични имейли → waitlist

**Tagline:** *Where global agriculture finds its voice.* — Nexus Group, 2026.

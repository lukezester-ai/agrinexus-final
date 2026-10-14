# Регистрация (waitlist) — Furrow

## Как работи

1. Потребителят попълва формата на сайта (`index.html` или `/register.html`).
2. Сайтът изпраща **POST** към `/api/waitlist`.
3. **Resend** изпраща:
   - имейл до вас (`FURROW_INBOX_EMAIL`) с данните;
   - потвърждение до абоната (EN/RU), ако `FURROW_WELCOME_EMAIL` не е `0`.

## Env в Vercel (проект furrow-github)

| Променлива | Задължителна | Пример |
|------------|--------------|--------|
| `RESEND_API_KEY` | Да | от [resend.com](https://resend.com) |
| `RESEND_FROM` | Да | `Furrow <noreply@твой-домейн.com>` |
| `FURROW_INBOX_EMAIL` | Да | `info@agrinexus.eu` |
| `FURROW_WELCOME_EMAIL` | Не | `0` = без потвърждение към потребителя |

След промяна → **Redeploy**.

## Алтернатива: Mailchimp

В env добавете:

- `FURROW_MAILCHIMP_URL`
- `FURROW_MAILCHIMP_HIDDEN`

Ако Resend липсва, формата ползва Mailchimp.

## URL-и

- Главна форма: https://furrow-github.vercel.app/#subscribe
- Регистрация: https://furrow-github.vercel.app/register.html

## Тест

```bash
curl -X POST https://furrow-github.vercel.app/api/waitlist \
  -H "Content-Type: application/json" \
  -d "{\"full_name\":\"Test\",\"email\":\"you@example.com\",\"interest\":\"grains\",\"lang\":\"en\"}"
```

Очакван отговор: `"ok": true` и съобщение за успех.

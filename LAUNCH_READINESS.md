# AgriNexus Launch Readiness (Definition of Done)

Използвайте този чеклист преди публично промотиране.
Статусите са:
- [ ] Not ready
- [x] Ready

## 1) Product Core

- [ ] `Marketplace` работи стабилно: филтри, търсене (EN/BG), карти и ключови метрики.
- [ ] `My Watchlist / My Cabinet` има ясен flow: запазване, известия, бързи преходи.
- [ ] `Pricing` секцията е ясна: концепция, ползи, FAQ, планове.
- [ ] `Client Portfolio` е последователно локализирано (BG/EN) без смесен UI език.

## 2) Chat Reliability

- [ ] Chat не блокира на `Thinking...` при бавна мрежа (timeout + retry работят).
- [ ] Mobile chat UX е стабилен: input не се покрива от клавиатурата, няма overlay конфликт.
- [ ] Clear behavior е консистентно (без нежелани авто-съобщения).
- [ ] При грешки потребителят получава ясен message, без счупване на останалата страница.

## 3) Forms and Lead Flow

- [ ] Contact form валидира правилно и връща ясна обратна връзка.
- [ ] Register form валидира email/phone и връща ясна обратна връзка.
- [ ] Backend endpoint-ите за `contact`, `register-interest`, `file-meta` работят в Preview и Production.
- [ ] Имейл потокът е проверен end-to-end (успешно получаване в inbox).

## 4) Security and Stability

- [ ] `OPENAI_API_KEY` и останалите чувствителни env променливи са само в environment settings.
- [ ] Няма секрети в репото (`.env` е игнориран и некомитнат).
- [ ] Upload/Chat endpoint-ите са защитени с базови мерки срещу abuse (лимити/валидиране/контрол).
- [ ] Няма критични runtime грешки в логовете на Preview deploy.

## 5) Deployment Quality

- [ ] `npm run typecheck` минава без грешки.
- [ ] Vercel Preview deploy е зелен и функционален.
- [ ] Production deploy е зелен и проверен с smoke тест.
- [ ] Критичните страници работят на desktop + mobile (latest Chrome/Safari).

## 6) Business Readiness

- [ ] Има едно ясно value proposition изречение (какъв проблем решава AgriNexus).
- [ ] Има 2-3 demo сценария за показване пред клиент (end-to-end).
- [ ] Има готова кратка sales презентация (1-pager или 5 слайда).
- [ ] Има ясна точка за контакт за продажби и onboarding.

## 7) Go-To-Market Gate

Публикуване и промотиране се стартират само ако:
- [ ] Всички точки в секции 1-5 са готови.
- [ ] Поне 3 от 4 точки в секция 6 са готови.
- [ ] Има определен owner за реакция при bug/issue след launch.

---

## Weekly Review (до launch)

Попълвайте всяка седмица:

- Дата:
- Общо готови точки: `__ / __`
- Блокери:
- Решение за седмицата: `Продължаваме по продукта` / `Готови за ограничен soft launch`


# AgriNexus — графичен слой (design system)

Единна визуална основа за маркетинговите HTML страници (светъл фон, Inter + JetBrains Mono, петте цветни семейства, навигация, hero, CTA, терминални блокове).

## Файлове

| Файл | Роля |
|------|------|
| `styles/agri-market-shared.css` | **Ядро:** `:root` токени, reset, `nav`, `hero`, `terminal-*`, `signal-*`, `section-header`, `data-cards`, `timeline`, тикер, мобилни корекции за всички основни страници. |
| `styles/agri-marketing-supplement.css` | **Допълнение за начална + агенти:** `stats-strip`, agent mesh (`mesh-container`, `orbit`, `orchestrator` с `orch-ring` анимация), `agents-grid`, `agent-card`, ladder, `btn-primary` / `btn-outline`. Зарежда се **след** shared. |
| `styles/article.css` | Статии / long-read (отделен ритъм). |
| `styles/sponsor.css` | Sponsor страница. |

Страници **само** със shared: `market-intelligence.html`, `analytics.html`, `ru/…` огледала.

Страници **shared + supplement**: `index.html`, `agents.html`, `ru/index.html`, `ru/agents.html`.

Страници **shared + собствен `<style>`** (палитрите и уникалните блокове си остават; подравнена е обвивката и контейнерът): `platform.html`, `academy.html`, `ru/platform.html`, `ru/academy.html` — зареждат `agri-market-shared.css` преди локалния блок; `.container` е **max-width: 1200px; padding: 0 24px** като останалия маркетинг.

## FieldLot — Agro-Modernism (отделен стек)

B2B агро UI (FieldLot): токени, типография, Yellow Pages режим и компонентни правила — **`docs/AGRO-MODERNISM-DESIGN-SYSTEM.md`**. Не се бърка с маркетинговите CSS файлове по-горе; ползва се за `fieldlot/*.html` прототипи и бъдещи FieldLot компоненти.

## Още не е обединено (нарочно или следваща стъпка)

- **`dashboard.html`** — продуктов UI; отделен слой (по желание същият `shared` линк по-късно).

## Правила за промени

1. Нови **общи** компоненти → `agri-market-shared.css`.
2. Само начало/агенти орбита/карти → `agri-marketing-supplement.css`.
3. Не дублирай `@keyframes pulse` — тикерът ползва `pulse`; оркестраторът ползва `orch-ring` в supplement.

## Next.js Academy (`apps/web`)

Академията в това копие е **Next приложението** под `apps/web` (не само маркетинговите `academy.html` страници по-горе).

- **Маршрути:** `/academy`, `/bg/academy`, каталог **`/academy/course/[slug]`**, лектор **`/academy/lecturer`**, лаборатория **`/academy/lab`**, карти **`/academy/maps`**, финален тест **`/academy/course/[slug]/test`** (`src/app/[locale]/academy/...`).
- **Каталог курсове и EN:** `apps/web/src/content/academy-courses.ts`, `apps/web/src/content/academy-en.ts`; финални тестове: `apps/web/src/content/final-course-tests/`.
- **Лекции (Markdown на диска):** `apps/web/public/lectures/courses/<slug>/` — виж **`apps/web/public/lectures/README.md`**.
- **Мобилно:** `apps/mobile/app/academy/`.
- **Продукт и архитектура (docs):** **`docs/ACADEMY_PRODUCT_VISION.md`**, **`docs/ACADEMY_ARCHITECTURE.md`**, **`docs/NAV-ACADEMY.md`**.

## Локална работна папка

Отваряй репото от **`C:\Users\expre\OneDrive\Desktop\project\agrinexus-final-main`** (или от **`C:\Users\expre\Academy`**, ако ползваш този clone) — виж **`docs/CANONICAL-WORKSPACE-BG.md`**, за да не се разминават пътища между Cursor и терминала.

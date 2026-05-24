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

## Още не е обединено (нарочно или следваща стъпка)

- **`dashboard.html`** — продуктов UI; отделен слой (по желание същият `shared` линк по-късно).

## Правила за промени

1. Нови **общи** компоненти → `agri-market-shared.css`.
2. Само начало/агенти орбита/карти → `agri-marketing-supplement.css`.
3. Не дублирай `@keyframes pulse` — тикерът ползва `pulse`; оркестраторът ползва `orch-ring` в supplement.

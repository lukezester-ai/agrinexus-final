# Agro-Modernism — дизайн система (FieldLot / B2B агро)

Име: **Agro-Modernism**. Цел: корпоративен SaaS за българския B2B агро сектор — четим навън, доверие при сделки, локален „жълти страници“ слой за обяви.

Свързани прототипи (Tailwind CDN + токени): `fieldlot/ai-guide.html`, `fieldlot/market.html`, `fieldlot/listing-detail.html`. По-ранна палитра: `fieldlot/public/styles/PALETTE.md`.

---

## Brand & narrative

Смес от **Corporate Modernism** и **Tactile Minimalism**:

| Режим | Роля |
|--------|------|
| **Professional Tech** | Много въздух, структура, дълбоки горски тонове — институционално доверие и „дигитална“ надеждност. |
| **Agricultural Heritage** | „Жълти страници“: топъл пергамент, злато на реколтата — физическа дъска с обяви, достъпно за традиционни потребители. |

Интерфейсът трябва да е **як, но изчистен** — търговска среда и четимост при силна осветеност на полето.

---

## Цветове (Earth & Harvest)

Философия: растеж и стабилност (primary), техничен котваж (secondary), стойност и акцент (tertiary), висок контраст за текст (ink/surface).

### Повърхности и текст

| Токен | HEX |
|--------|-----|
| `surface` | `#f0fdf2` |
| `surface-dim` | `#d0ddd3` |
| `surface-bright` | `#f0fdf2` |
| `surface-container-lowest` | `#ffffff` |
| `surface-container-low` | `#eaf7ec` |
| `surface-container` | `#e4f1e7` |
| `surface-container-high` | `#deebe1` |
| `surface-container-highest` | `#d9e6dc` |
| `on-surface` | `#131e18` |
| `on-surface-variant` | `#404944` |
| `inverse-surface` | `#28332c` |
| `inverse-on-surface` | `#e7f4ea` |
| `outline` | `#717974` |
| `outline-variant` | `#c0c9c2` |
| `surface-tint` | `#366853` |
| `surface-variant` | `#d9e6dc` |
| `background` | `#f0fdf2` |
| `on-background` | `#131e18` |

### Primary (Forest Green)

| Токен | HEX |
|--------|-----|
| `primary` | `#003625` |
| `on-primary` | `#ffffff` |
| `primary-container` | `#1a4d3a` |
| `on-primary-container` | `#89bda4` |
| `inverse-primary` | `#9ed2b9` |
| `primary-fixed` | `#b9eed4` |
| `primary-fixed-dim` | `#9ed2b9` |
| `on-primary-fixed` | `#002115` |
| `on-primary-fixed-variant` | `#1d4f3c` |

### Secondary (Slate / Charcoal)

| Токен | HEX |
|--------|-----|
| `secondary` | `#536259` |
| `on-secondary` | `#ffffff` |
| `secondary-container` | `#d1e1d6` |
| `on-secondary-container` | `#55645b` |
| `secondary-fixed` | `#d6e6db` |
| `secondary-fixed-dim` | `#bacac0` |
| `on-secondary-fixed` | `#111e18` |
| `on-secondary-fixed-variant` | `#3c4a42` |

### Tertiary (Harvest Gold)

| Токен | HEX |
|--------|-----|
| `tertiary` | `#755b00` |
| `on-tertiary` | `#ffffff` |
| `tertiary-container` | `#cea72c` |
| `on-tertiary-container` | `#4f3d00` |
| `tertiary-fixed` | `#ffe08e` |
| `tertiary-fixed-dim` | `#ecc246` |
| `on-tertiary-fixed` | `#241a00` |
| `on-tertiary-fixed-variant` | `#584400` |

### Error

| Токен | HEX |
|--------|-----|
| `error` | `#ba1a1a` |
| `on-error` | `#ffffff` |
| `error-container` | `#ffdad6` |
| `on-error-container` | `#93000a` |

### Yellow Pages (пергамент)

За режим „жълти страници“ използвай **пергаментен градиент** (не чисто бяло):

- Препоръка: `#f0dba8` → `#faf6ec` (или близък топъл градиент към `#fffdf0`).

Картите в този режим: **4px горна лента** в harvest gold (`tertiary-container` / `#cea72c`), **солена сянка** отдолу (`0 3px 0 rgba(0,0,0,0.12)`) и леко **златисто ореол** (`0 8px 24px rgba(201, 162, 39, 0.15)`). При hover: потъмняване на горната линия и по-широк „аура“ shadow.

---

## Типография (DM Sans само)

Минимум **400** за тяло; заглавия **600–700**. Без light тегла — четимост на слънце.

| Стил | Размер | Тегло | Височина | Letter-spacing |
|------|--------|-------|----------|----------------|
| `display-lg` | 52px | 700 | 1.06 | -0.035em |
| `display-lg-mobile` | 34px | 700 | 1.1 | -0.02em |
| `headline-md` | 40px | 700 | 1.1 | -0.03em |
| `headline-sm` | 24px | 600 | 1.2 | -0.01em |
| `body-base` | 16px | 400 | 1.5 | 0 |
| `body-sm` | 14px | 400 | 1.5 | 0 |
| `label-eyebrow` | 11px | 600 | 1.2 | **0.12em** |
| `label-badge` | 10px | 700 | 1.0 | **0.06em** |

**Правила:** широк letter-spacing за eyebrow/badge при ниска резолюция; йерархията скалира агресивно на десктоп и се свива до **34px** display на мобилно.

---

## Заобляне (rounded)

| Ключ | Стойност |
|------|----------|
| `sm` | 0.25rem (4px) — **Yellow Pages карти** (ряз на хартия) |
| `DEFAULT` | 0.5rem (8px) — стандартни карти и полета |
| `md` | 0.75rem |
| `lg` | 1rem |
| `xl` | 1.5rem |
| `full` | 9999px — **бутони (pill)**, **търсене (pill)** |

---

## Spacing

| Токен | Стойност |
|-------|----------|
| `base` / `xs` | 4px |
| `sm` | 8px |
| `md` | 16px |
| `lg` | 24px |
| `xl` | 32px |
| `xxl` | 48px |
| `container-max` | 1140px |
| `gutter` | 16px |
| `margin-mobile` | 12px |

**Ритъм:** базова мрежа **4px**. **Listing grid:** `repeat(auto-fill, minmax(280px, 1fr))`, gap **16px**. Desktop margin **16px**, mobile **12px** за повече хоризонтално място. **Touch targets:** минимум **44px** височина за интерактивни елементи.

---

## Дълбочина и навигация

- **SaaS / tonal cards:** бяло върху мек фон (`#f6f8f5` или `surface-*`), разделение с **1px** `#dde5df` / `outline-variant`; предпочитай outline пред тежки сенки.
- **Yellow Pages:** тактилна сянка + златист ореол (виж по-горе).
- **Header:** glassmorphism — **~96% непрозрачност** + **backdrop blur 12px**, за контекст при скрол в гъсти списъци.

---

## Компоненти (кратко)

### Бутони

- **Primary:** `primary` фон, `on-primary` текст, **pill**, височина **48px** за главни CTA.
- **Secondary:** прозрачен фон, **1px** slate/secondary border, pill.
- **Hover:** леко потъмняване + **translateY(-2px)** за тактилна обратна връзка.

### Карти (Yellow Pages listing)

- Структура: **4px** top accent в harvest gold.
- Фон: топъл пергаментен градиент.
- Hover: потъмняване на accent + по-силен златист shadow.

### Полета

- Височина **44px**, светла рамка.
- **Focus:** рамка към forest green + мек ореол `0 0 0 3px` с ниска непрозрачност на primary.

### Details drawer

- Панел отдясно за детайли на оферта.
- Header: **solid primary** + **тънка лента** tertiary отгоре за бранд при „deep dive“.

### Chips & badges

- Типография `label-badge`, висок letter-spacing.
- Фон: леки тонове според категорията (grain, equipment, …).

---

## Имплементация в репото

| Слой | Файл / място |
|------|----------------|
| Маркетинг AgriNexus (друг стек) | `docs/DESIGN-SYSTEM.md`, `styles/agri-market-*.css` |
| FieldLot B2B палитра (кратко) | `fieldlot/public/styles/PALETTE.md` |
| FieldLot Tailwind CDN прототипи | `fieldlot/*.html` — `tailwind.config` в `<script id="tailwind-config">` |

При добавяне на нови екрани поддържай токените и правилата тук; при разминаване — **тази страница е източник на истина** за Agro-Modernism, освен ако не е договорено друго.

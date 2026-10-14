# Единен академичен nav (шаблон)

Копирайте блока за **EN (корен на сайта)** или **BG (`bg/`)** във всеки пълен маркетингов HTML с хоризонтален `<nav>`. Ползвайте **само един** от двата варианта според езика и папката.

## Плейсхолдери

| Плейсхолдер | Пример EN | Пример BG |
|---------------|-----------|-----------|
| `{{SELF_EN}}` | `analytics.html` | `../analytics.html` |
| `{{SELF_BG}}` | `bg/analytics.html` | `analytics.html` |

За `index.html` (EN): `{{SELF_EN}}` = `index.html`, `{{SELF_BG}}` = `bg/index.html`.  
За `academy.html` (EN): `{{SELF_EN}}` = `academy.html`, `{{SELF_BG}}` = `bg/academy.html`.

## EN — корен (`/`)

```html
        <nav>
    <a href="index.html" class="logo" style="text-decoration: none; color: inherit; display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 20px;">
        <div class="logo-dot" style="width: 8px; height: 8px; background-color: var(--green, #2d5a27); border-radius: 50%;"></div>
        AgriNexus Academy
    </a>
    <div style="display: flex; gap: 22px; align-items: center; font-size: 14px; font-weight: 500; flex-wrap: wrap;">
        <a href="index.html" style="text-decoration: none; color: var(--text-muted, #666); transition: color 0.2s;" onmouseover="this.style.color='var(--text-main, #111)'" onmouseout="this.style.color='var(--text-muted, #666)'">Start</a>
        <a href="academy.html" style="text-decoration: none; color: var(--text-muted, #666); transition: color 0.2s;" onmouseover="this.style.color='var(--text-main, #111)'" onmouseout="this.style.color='var(--text-muted, #666)'">Library</a>
        <a href="index.html#lab" style="text-decoration: none; color: var(--text-muted, #666); transition: color 0.2s;" onmouseover="this.style.color='var(--text-main, #111)'" onmouseout="this.style.color='var(--text-muted, #666)'">Lab</a>
        <a href="index.html#compare" style="text-decoration: none; color: var(--text-muted, #666); transition: color 0.2s;" onmouseover="this.style.color='var(--text-main, #111)'" onmouseout="this.style.color='var(--text-muted, #666)'">Models</a>
        <a href="agents.html" style="text-decoration: none; color: var(--text-muted, #666); font-size: 13px; opacity: 0.85;">Archive</a>
    </div>
    <div style="display: flex; gap: 12px; align-items: center; font-size: 13px; font-weight: 600; margin-left: auto; margin-right: 24px; color: var(--text-muted, #999);">
        <a href="{{SELF_EN}}" style="color: var(--text-main, #111); text-decoration: none;">EN</a>
        <span style="opacity: 0.3;">|</span>
        <a href="{{SELF_BG}}" style="color: inherit; text-decoration: none;">BG</a>
    </div>
</nav>
```

## BG — папка `bg/`

Връзки: `index.html`, `academy.html`, `index.html#lab`, `index.html#compare`, `agents.html`; език EN = `../ИМЕ.html`, BG = текущ файл.

## Изключения

- **`dashboard.html`**: логото в aside → `index.html` (Academy home).
- **`course.html`**: компактен същият ред връзки.
- **Статии** с `article-nav`: по избор.

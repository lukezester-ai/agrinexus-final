# Канонична работна папка (локално)

**За тази машина (OneDrive, ASCII път):** дръж основното работно копие на монорепото тук:

**`C:\Users\expre\OneDrive\Desktop\project\agrinexus-final-main`**

Така в корена имаш `.git`, `package.json`, `apps/`, `docs/` и т.н., без объркване с друго копие. GitHub източник: [roxsonltd-droid/ai-agri-academy](https://github.com/roxsonltd-droid/ai-agri-academy).

## Алтернатива: отделен корен без OneDrive

Ако предпочиташ път без `OneDrive` в името, използвай **`C:\Users\expre\Academy`** (клонирай или премести съдържанието там). Скриптовете поддържат и двата варианта чрез параметър `-CanonicalRepoRoot`.

## Кирилица `Desktop\проект\agrinexus-final-main`

Ако имаш втори път с кирилица, не копирай файлове на ръка — пусни от **този** корен:

```powershell
cd C:\Users\expre\OneDrive\Desktop\project\agrinexus-final-main
powershell -ExecutionPolicy Bypass -File .\scripts\windows\link-cyrillic-desktop-folder.ps1
```

Това създава **junction** от `...\проект\agrinexus-final-main` към тази папка (по подразбиране). Подробности: [`WORKSPACE-CYRILLIC-PATH-BG.md`](./WORKSPACE-CYRILLIC-PATH-BG.md).

## Бърз терминал

Двоен клик на **`Open-Academy-Terminal.cmd`** в корена отваря `cmd` в тази папка (или в `C:\Users\expre\Academy`, ако там има репо с `.git`).

## Свързани документи

- [`LOCAL-DEV.md`](./LOCAL-DEV.md)
- [`WORKSPACE-CYRILLIC-PATH-BG.md`](./WORKSPACE-CYRILLIC-PATH-BG.md)

## Академия (Next.js + лекции)

Пълният учебен слой е в **`apps/web`**: маршрути под `/academy` (виж **`docs/DESIGN-SYSTEM.md`** § Next.js Academy). Лекциите като файлове: **`apps/web/public/lectures/README.md`**. Продуктов контекст: **`docs/ACADEMY_PRODUCT_VISION.md`**, **`docs/ACADEMY_ARCHITECTURE.md`**.

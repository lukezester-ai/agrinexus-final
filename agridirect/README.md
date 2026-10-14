# Статичен индекс на статии (Furrow)

Папката `agridirect/` съдържа **опционален статичен изход** (JSON + прости HTML страници) за списък и преглед на статии — част от **Furrow Markets**, не отделен продукт. Редакционните лонгридове са на [`/archive`](../archive.html).

## Защо не се „тегли“ автоматично от защитен remote?

Ако remote инстанцията използва **Vercel Deployment Protection** (401 без сесия), анонимен `fetch` към `/api/…` от тук няма да мине.

## Как да обновите експорта

### Вариант A — от локални JSON (препоръчително)

След като имате актуални `articles.json` и `prices.json` в папката от `AGRIDIRECT_DATA_DIR` (виж подразбирането в `scripts/sync-agridirect-articles.mjs` или задай свой абсолютен път):

```bash
cd furrow-github
npm run sync:agridirect
```

Друг път към данните:

```bash
set AGRIDIRECT_DATA_DIR=C:\path\to\market-data\data
npm run sync:agridirect
```

### Вариант B — от защитен remote (bypass secret)

1. В целевия Vercel проект включете **Protection Bypass for Automation** и копирайте секрета.

```powershell
$env:AGRIDIRECT_REMOTE="https://your-deployment.vercel.app"
$env:VERCEL_AUTOMATION_BYPASS_SECRET="..."
npm run sync:agridirect
```

След deploy на този repo статичният изход е достъпен на `…/agridirect/` — част от същия Furrow сайт.

## Изход

- `agridirect/data/articles-export.json` — индекс за списъка в `index.html`
- при нужда: допълнителни HTML от логиката на sync скрипта

---
name: marketplace-create-page
description: Добавя UI за създаване на skill през уеб интерфейса, zip‑експортиране и съхранение в Supabase, плюс динамично комбиниране на статични и публични skills.
---

# План за имплементация

## 1️⃣ Създаване на Supabase клиент (frontend) – вече е добавен `apps/web/lib/supabase.ts`.

## 2️⃣ UI страница `/create`
- **Файл:** `apps/web/pages/create.tsx`
- **Компонент:** React форма с полетата:
  - `name` (string, задължително)
  - `description` (string)
  - `instructions` (многострочно текстово поле, Markdown/MDX‑поддръжка)
  - `files` – drag‑&‑drop / file‑input, събира всички файлове, които потребителят иска да прикачи.
- **Валидация:** използва `zod` (ако още няма) или прост TS‑check; проверява задължителни полета и размер на файловете (< 5 MB).
- **Преглед:** след попълване се показва Markdown preview (чрез `marked`).
- **ZIP:** използва `jszip` (import от CDN в браузъра) за създаване на архив, включва `SKILL.md` (комбинация от front‑matter + инструкции) и всички прикачени файлове.
- **Supabase insert:** след генериране на ZIP, файлът се качва в Supabase Storage `skills/` (public bucket) и записва в таблица `skills` със следните полета:
  ```sql
  id UUID primary key default gen_random_uuid(),
  user_id UUID references auth.users(id),
  name text,
  description text,
  instructions text,
  files_json jsonb,   -- {"zip_url":"https://…/…zip"}
  public boolean default true,
  created_at timestamp with time zone default now()
  ```
  Записът се прави чрез `supabase.from('skills').insert([...])`.
- **Успешно съобщение** – редирект към `/marketplace`.

## 3️⃣ API endpoint за AI‑подобряване (по желание)
- **Файл:** `apps/web/pages/api/ai-improve.ts`
- **Метод:** `POST` приема `{name, description, instructions}`.
- **Логика:** извиква LLM (например Claude/ChatGPT) чрез сервер‑страничен **FastAPI** endpoint или директно чрез `openai`/`anthropic` библиотека (ключът се съхранява в env `NEXT_PUBLIC_OPENAI_KEY` – **не** се експортира към клиент).
- **Rate limiting:** използва `lru-cache` за IP‑rate‑limit (max 5 заявки/минута).
- **Отговор:** върнато подобрено `description` и `instructions`.
- **Защита:** проверка, че заявката идва от аутентикиран потребител (`supabase.auth.getUser()`).

## 4️⃣ Динамичен Marketplace списък
- **Файл:** `apps/web/pages/marketplace.tsx`
- **Логика:** 
  1. `fetch('/public/skills-index.json')` → статични skills.
  2. `supabase.from('skills').select('*').eq('public', true)` → публични потребителски skills.
  3. Обединява двата масива, сортира по `created_at`.
  4. Рендерира `SkillCard` за всеки елемент (показва име, описание, линк към zip‑файла).
- **SSR/SSG:** използва `getServerSideProps` (по‑лесно за Supabase client), но може да се превърне в `getStaticProps` с ISR.

## 5️⃣ Стилове и компоненти
- Добавям `components/SkillCard.tsx` – общ UI за статичен и потребителски skill.
- Използвам вече наличните Tailwind и Radix UI за форма.

## 6️⃣ Тестове и проверка
- Добавям единични тестове с `jest` (ако проектът ги има) за `zip` генерация и Supabase insert.
- Пускам `npm run lint` и `npm run typecheck`.

## 7️⃣ Документация
- Обновявам `README.md` с нови API маршрути и инфо за Supabase таблица.

---

**Следващи стъпки** (можем да ги изпълним автоматично):
1. Създаване на `create.tsx`, `SkillCard.tsx`, `marketplace.tsx`.
2. Добавяне на API файл `api/ai-improve.ts`.
3. (Опционално) Инсталиране на npm зависимости: `npm i jszip @supabase/supabase-js zod`.
4. Пускане на `npm run lint` и `npm run typecheck` за проверка.

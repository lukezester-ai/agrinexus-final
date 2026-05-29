# Лекции (Markdown)

**Каноничен корен на репото:** `C:\Users\expre\OneDrive\Desktop\project\agrinexus-final-main` — виж `docs/CANONICAL-WORKSPACE-BG.md`.

## Структура с курсове

Лекциите за академията са в **`public/lectures/courses/<курс>/...md`**.

Каталогът на курсовете и връзките към файловете са в **`src/content/academy-courses.ts`**.

### Нова лекция в съществуващ курс

1. Добавете `.md` под съответната папка на курса.
2. Добавете обект в масива `lectures` на курса в `academy-courses.ts`.

### Нов курс

1. Нова папка `public/lectures/courses/<slug>/`.
2. Нов обект в масива `COURSES` в `academy-courses.ts`.
3. Преводи за EN в `src/content/academy-en.ts`.
4. Финален тест: 25 въпроса в `src/content/final-course-tests/<slug>.ts` и регистрация в `final-course-tests/index.ts`.

Страницата **„Лектор“** (`/academy/lecturer`) зарежда текста от `/lectures/<file>`.

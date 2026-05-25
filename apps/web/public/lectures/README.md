# Лекции (Markdown)

## Структура с курсове

Лекциите за академията са в **`public/lectures/courses/<курс>/...md`**.

Каталогът на курсовете и връзките към файловете са в **`src/content/academy-courses.ts`**.

### Нова лекция в съществуващ курс

1. Добавете `.md` под съответната папка на курса.
2. Добавете обект в масива `lectures` на курса в `academy-courses.ts`.

### Нов курс

1. Нова папка `public/lectures/courses/<slug>/`.
2. Нов обект в масива `COURSES` в `academy-courses.ts`.

Страницата **„Лектор“** (`/academy/lecturer`) зарежда текста от `/lectures/<file>`.

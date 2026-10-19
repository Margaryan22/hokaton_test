# Голосовой ассистент: задачи, напоминания, встречи

Прототип веб-ассистента: голосом или текстом на русском создаёт задачи, напоминания и встречи, показывает планы на период и находит старые записи. Работает без платных ключей.

## Быстрый старт

Нужен только Node.js 22.12+ (проверено на Node 24).

```bash
npm run setup   # зависимости, локальная БД data/app.db, миграции, демо-история из CSV
npm run dev     # http://localhost:3000
```

Голосовой ввод — в Chrome или Edge (Web Speech API). Текстовый ввод работает в любом браузере.

## Команды

| Что | Команда |
|---|---|
| Установка и БД | `npm run setup` |
| Разработка | `npm run dev` |
| Продакшен-сборка и запуск | `npm run build`, затем `npm run start` (или `npm run preview`) |
| Юнит-тесты | `npm run test` |
| E2E-тесты | `npx playwright install chromium` (один раз), затем `npm run test:e2e` |
| Линт и типы | `npm run lint`, `npm run typecheck` (всё вместе: `npm run check`) |
| Новая миграция после изменения схемы | `npm run db:generate` |
| Применить миграции / сид | `npm run db:migrate`, `npm run db:seed` |

## Настройки (`.env`)

Скопируйте `.env.example` в `.env` (setup работает и без этого — по умолчанию `file:./data/app.db`).

| Переменная | Назначение |
|---|---|
| `DATABASE_URL` | `file:./data/app.db` локально; `libsql://….turso.io` на хостинге |
| `DATABASE_AUTH_TOKEN` | токен Turso (только для хостинга) |
| `APP_NOW` | зафиксировать «сейчас», например `2026-10-19T10:00:00+03:00`; пусто — реальное время МСК |

## Деплой (бесплатно: Vercel + Turso)

1. В веб-консоли [Turso](https://app.turso.tech) (тариф Free) создайте базу `voice-assistant` в регионе Frankfurt (AWS eu-central-1), скопируйте её URL (`libsql://…`) и создайте токен доступа (Create Token).
2. Импортируйте репозиторий в [Vercel](https://vercel.com) (Hobby). Фреймворк определится сам; команда сборки берётся из `vercel.json` (миграции и сид перед `next build`).
3. В Vercel → Settings → Environment Variables задайте `DATABASE_URL` и `DATABASE_AUTH_TOKEN` из шага 1. `APP_NOW` не задавайте.
4. Deploy. Данные хранятся в Turso и переживают перезапуски и «засыпание».

Ссылка на работающий прототип: _добавляется после деплоя_.

## Технологии и архитектура

Выбор стека и альтернативы — `.crew/decisions/ADR-001-*.md`; архитектура (голос / понимание запроса / бизнес-логика / хранение) — `docs/architecture.md`.

- Next.js 16 + TypeScript, Tailwind CSS 4
- SQLite через libSQL + Drizzle ORM (локально файл, на хостинге Turso)
- Понимание запроса: собственные правила + Luxon (даты в Europe/Moscow)
- Поиск: стемминг Snowball + синонимы + нечёткое совпадение
- Голос: Web Speech API браузера
- Тесты: Vitest, Playwright

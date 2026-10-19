# T-004: ревью безопасности

Коммит: d547d95. Вердикт: **pass** (критических и высоких находок нет).

## Что проверено

- `GET/PATCH /api/records[/id]`, `GET/POST /api/session`, `GET /api/users`, `src/server/session.ts`, `src/server/services/{records,errors,rate-limit}.ts`, репозитории `src/db/records.ts`, `src/db/users.ts`.
- Авторизация: `userId` берётся только из cookie `uid` через `resolveUser` (Zod `coerce.number().int().positive()`, неизвестный id → 401, не 500). Все запросы к `records` (select/update/delete/count/list) содержат `eq(records.userId, userId)`; `PATCH` чужой записи → 404.
- Входы: `[id]` — `RecordIdSchema`; тело PATCH — `z.strictObject({ done })` (лишние поля вроде `userId` отклоняются); имя — Zod 1–40. Сервис записей проверяет заголовок (≤200), дату (2000–2100), время.
- SQL: только билдер Drizzle и `sql`-шаблон без пользовательских данных.
- Ошибки: 500 без стека и текста; `console.error` пишет только `error.name` (L5 из архитектурного ревью выполнено).
- Cookie: httpOnly, `sameSite: lax`, `secure` в production.
- M1: лимит записей на пользователя и лимит частоты `POST /api/session` (30/мин на адрес, ограничение числа ключей 10 000) есть.
- `npm run audit` — 0 уязвимостей; поиск секретов по файлам задачи — пусто; `dangerouslySetInnerHTML` нет.

## Находки (не блокируют)

- **Low. Login CSRF (L1) не закрыт.** `src/app/api/session/route.ts:38` читает `request.json()` без проверки `Content-Type`/`Origin`; форма `enctype="text/plain"` со стороннего сайта может переключить посетителя на другое имя. Исправление: отклонять запросы без `Content-Type: application/json` или с `Origin` не своего хоста (можно для всех POST/PATCH).
- **Low. Лимит частоты слабый на Vercel.** `RateLimiter` живёт в памяти одного экземпляра функции; при нескольких экземплярах лимит умножается. `clientKey` (`src/server/session.ts:64`) доверяет `X-Forwarded-For` — на Vercel заголовок ставит платформа, при другом хостинге его можно подделать. Для прототипа приемлемо (архитектурное ревью M1).
- **Low. Лимит записей не атомарен.** `createRecord` (`src/server/services/records.ts:82`) считает, потом вставляет; параллельные запросы могут чуть превысить `MAX_RECORDS_PER_USER`. Практического вреда нет.
- **Info. Оставшаяся часть M1** — лимит частоты для `POST /api/chat` и обрезка `dialog_messages` — вне этой задачи; проверю в задаче диалога/чата.

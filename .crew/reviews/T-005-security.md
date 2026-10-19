# T-005: ревью безопасности

Коммиты: 382885e, 17f337a. Проверено: `src/app/api/chat/route.ts`, `src/app/api/dialog/route.ts`, `src/app/api/dialog/reset/route.ts`, `src/server/dialog/{engine,transition,state,replies}.ts`, вызываемые `src/db/dialog.ts`, `src/db/records.ts`, `src/server/services/records.ts`, `src/server/session.ts`, `src/server/services/rate-limit.ts`.
Сканеры: `npm run audit` — 0 уязвимостей; поиск секретов по файлам задачи — пусто.

## Что подтверждено

- Пользователь только из cookie `uid` (`resolveUser`, Zod `coerce.int().positive()`, несуществующий → 401) во всех трёх маршрутах.
- id из состояния диалога (`recordId`, `candidateIds`, `conflictIds`, `write.recordId`) и `focus_record_id` разрешаются через `find(ctx, id)` по `ctx.records = listAllRecords(tx, userId)`; эффекты применяются через `updateRecord/setDone/deleteRecord(db, userId, id)` с `userId` в `WHERE`; `setDialogState` обнуляет чужой фокус. `state_json` валидируется Zod при чтении, мусор → idle.
- Удаление — только после «да», цель из серверного состояния (security.md п.8).
- M1: лимит 60 сообщений/мин на IP+пользователя в `POST /api/chat`; `dialog_messages` обрезается до 200 на пользователя в `addDialogMessage`; записи — 2000 на пользователя в `createRecord`.
- Ввод: `ChatRequestSchema` (trim, 1–500). SQL — только билдер Drizzle. Ошибки — код и русское сообщение; `console.error` пишет только имя ошибки. Изменяющие маршруты — POST.

## Medium (не блокирует)

- **M-a.** `src/server/session.ts:64` — ключ лимита берёт первый хоп `X-Forwarded-For`. На Vercel заголовок выставляет платформа, но вне Vercel клиент может его подменять и обходить лимит по IP; лимит к тому же в памяти одного инстанса. Для прототипа достаточно; при смене хостинга брать адрес от доверенного прокси.
- **M-b.** `src/server/services/rate-limit.ts:2` — `RATE_LIMIT_DISABLED=1` отключает лимит; не задавать в Vercel production (стоит упомянуть в `deploy.md`/README).

## Low / info

- `items_json` из БД парсится без схемы (`engine.ts:39`) — пишет его только сервер, вывод через React как текст; риска нет.

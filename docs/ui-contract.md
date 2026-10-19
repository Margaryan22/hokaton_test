# UI contract

Names that the end-to-end tests (`e2e/*.spec.ts`) rely on. Executors build to these names; change them only together with the tests. Sources: `.crew/brief.md`, `docs/architecture.md` (API, reply wording), `docs/design.md` (look). Clock in tests: Monday 2026-10-19 10:00 Europe/Moscow (`APP_NOW`).

## Page `/`

One page. Heading (h1): «Голосовой ассистент».

| Element | How tests find it | Notes |
|---|---|---|
| Message field | `getByLabel("Сообщение", { exact: true })` | visible label «Сообщение»; Enter submits; enabled once a user is selected |
| Send button | `getByRole("button", { name: "Отправить", exact: true })` | |
| Mic button | `getByRole("button", { name: "Записать голос" })` | `aria-label="Записать голос"` when idle **and** when unavailable (then `disabled`); «Остановить запись» only while listening |
| Mic notice | `getByText("Голосовой ввод недоступен, введите текст", { exact: true })` | visible when no `SpeechRecognition`/`webkitSpeechRecognition` or after an `error` event (`not-allowed`); text field stays usable |
| Sound toggle | `getByRole("button", { name: "Звук: вкл" \| "Звук: выкл", exact: true })` | visible text exactly that; default «вкл»; persisted in localStorage `va:sound` |
| Dialog feed | `getByRole("log")` | user and assistant bubbles, text as sent/replied; history survives reload (`GET /api/dialog`) |
| Records panel | `getByRole("region", { name: "Записи" })` | `<section aria-label="Записи">`; one `<ul>`, each record = one `<li>` (`getByRole("listitem")`) |
| Record row | text of the `<li>` | title (original case), date/time line, kind chip «Задача» / «Встреча» / «Напоминание», status text «Выполнено» when done (nothing extra when not done) |
| Empty list | text inside the panel | «Записей пока нет» (no records at all); empty search/period result: no `<li>` |
| User select | `getByLabel("Пользователь", { exact: true })` | native `<select>`; option text = user name; current user selected |
| New user field | `getByLabel("Новое имя", { exact: true })` | |
| Create button | `getByRole("button", { name: "Создать", exact: true })` | finds the name (case-insensitive) or creates it, switches to it and reloads feed + panel: one action. Same button for an existing name |
| New dialog | button «Новый диалог» | calls `POST /api/dialog/reset` |

Records panel after every chat reply shows `panel` of that reply (AC-07: the screen equals the reply). Checkbox per row: `aria-label` «Отметить выполненной: <название>».

## API used directly by tests

As in `docs/architecture.md#4-api`: `POST /api/session {name}` (sets cookie), `GET /api/users`, `POST /api/chat {text}` -> `ChatResponse`, `GET /api/records` -> `Panel`, `PATCH /api/records/:id {done}`, `POST /api/dialog/reset`, `GET /api/health`.
Formats the tests assume (the architecture leaves them open): `RecordDto.date` = `"YYYY-MM-DD"` (Moscow day), `RecordDto.time` = `"HH:mm"` or `null`, `RecordDto.id` = database id (for «Демо» equal to the CSV id), `awaiting` values `slot | yes_no | choice | target | null`. No cookie -> 401 on `/api/records` and `/api/chat`; foreign record id in `PATCH` -> 404.

## Assistant wording the tests check (substrings unless "exact")

| Situation | Text |
|---|---|
| reminder created | contains «20 октября», «10:00», «позвонить Ивану» (e.g. «Напомню 20 октября в 10:00: позвонить Ивану») |
| task created | no «?»; with deadline contains «25 октября» |
| meeting created | contains «встреч…», date «20 октября», time «15:00» |
| missing meeting time | «На какое время поставить встречу?» (awaiting `slot`); nothing saved |
| conflict | contains the conflicting title and «Всё равно поставить?» (awaiting `yes_no`); «да»/«нет» via text |
| delete question | «Удалить задачу «купить билеты»?» (awaiting `yes_no`) |
| several matches | exact: «Нашёл несколько задач: 1. подготовить отчёт для банка; 2. подготовить отчёт для клиента. Какую удалить?» (awaiting `choice`); answer «2» |
| move without context | «Какую запись перенести?» (awaiting `target`) |
| move done | contains «Перенёс» (ё/е tolerated) and the new date «20 октября» |
| empty period | «На сегодня ничего не запланировано», «На завтра …», «На следующую неделю …» |
| exists | reply starts with «Да» / «Нет» |
| search results | reply lists dates like «4 апреля 2025», «27 сентября 2025», «5 марта 2026» (year shown when not 2026) |
| nothing found | contains «Ничего не нашёл» and «уточн…» |
| not understood | contains «не понял» and 2-3 examples in «…» quotes |

## Interpretations of ambiguous criteria

- AC-10(b)/AC-11(a): only the property of the result is tested (at most 5, all tasks, all with the keyword), plus the ids the brief names as mandatory (2, 5, 7). Ids 32 and 66 for the presentation search are not required by the tests (the brief permits other equal tasks).
- AC-22: «1000 records» is verified through the public query «Что у меня <дата>?» on sample dates across 2024..2027, compared with `docs/source/voice_assistant_events.csv` (ids, order, kind by the type rule, time, title); duplicates would show up as extra rows. The only user-facing way to a total count does not exist, so no raw count is asserted.
- AC-18: «каждый ответ озвучивается» is checked by stubbing `speechSynthesis.speak` (one call per reply, text = reply text). AC-19: recogniser absence is simulated by setting `window.SpeechRecognition`/`webkitSpeechRecognition` to `undefined`; permission denial by a fake recogniser firing `error` with `not-allowed` after `start()` (handler via `onerror` or `addEventListener`).
- AC-21: restart of the server cannot be done in a test; persistence is checked over reload and a fresh browser context signing in by the same name.
- AC-23: no key variables in `.env.example`, no LLM SDK in dependencies, and the main phrases succeed on the keyless e2e server.
- AC-24: static checks of `README.md` headings (запуск, технологии, самостоятельные решения, что улучшить; mention of `docs/architecture.md`) and of `docs/architecture.md` (layers). The hosted link is not tested.
- Unit tests for NLU/search/CSV import are not written by QA: their module interfaces (`parse`, `searchRecords`, csv-import) have no fixed signatures in the architecture; owners write them test-first.

## Acceptance tests

Run: `npm run test:e2e` (one test: `npx playwright test -g "AC-05"`). Each test uses its own unique user, except tests on «Демо», which only read.

| AC | File | Tests |
|---|---|---|
| AC-01 | `e2e/create.spec.ts` | AC-01 reminder for tomorrow 10:00 ... |
| AC-02 | `e2e/create.spec.ts` | AC-02 task for Friday without a time ... |
| AC-03 | `e2e/create.spec.ts` | AC-03 task 'until the end of the week' ... |
| AC-04 | `e2e/create.spec.ts` | AC-04 meetings are created ... |
| AC-05 | `e2e/create.spec.ts` | AC-05 meeting without a time ... |
| AC-06 | `e2e/create.spec.ts` | AC-06 relative dates ... |
| AC-07 | `e2e/lists.spec.ts` | AC-07 three phrasings mean 'list for today' ... |
| AC-08 | `e2e/lists.spec.ts` | AC-08 tasks for tomorrow only; this week sorted ...; AC-08 'are there meetings today' ... |
| AC-09 | `e2e/lists.spec.ts` | AC-09 empty period ... |
| AC-10 | `e2e/search.spec.ts` | AC-10 (a) contract; AC-10 (b) presentation |
| AC-11 | `e2e/search.spec.ts` | AC-11 (a) word form 'отчёты'; AC-11 (b) meeting with Ivan in the past |
| AC-12 | `e2e/search.spec.ts` | AC-12 nothing found ... |
| AC-13 | `e2e/dialog.spec.ts` | AC-13 unrecognised phrase ... |
| AC-14 | `e2e/dialog.spec.ts` | same time + 'да'; same time + 'нет'; 15:30 overlaps; 16:00 no conflict |
| AC-15 | `e2e/dialog.spec.ts` | complete + delete + 'да'; 'нет' keeps the record |
| AC-16 | `e2e/dialog.spec.ts` | move after creating; new dialog asks which record |
| AC-17 | `e2e/dialog.spec.ts` | several matches ... |
| AC-18 | `e2e/ui.spec.ts` | page elements and speech on; sound off + reload |
| AC-19 | `e2e/ui.spec.ts` | no recogniser; permission denied |
| AC-20 | `e2e/ui.spec.ts` | Anna/Boris through the switcher; API isolation, 404 and 401 |
| AC-21 | `e2e/ui.spec.ts` | reload and new browser session |
| AC-22 | `e2e/search.spec.ts` | 26 January 2024; CSV spot checks; type rule; other user has no history |
| AC-23 | `e2e/keyless-docs.spec.ts` | no paid key needed ... |
| AC-24 | `e2e/keyless-docs.spec.ts` | README and architecture doc ... |

Shared helpers: `e2e/helpers.ts`.

# Dates and times: Luxon in Europe/Moscow

## Version and sources
- luxon 3.7.2, @types/luxon 3.7.6.
- https://moment.github.io/luxon/#/zones (raw: https://github.com/moment/luxon/blob/master/docs/zones.md)
- https://moment.github.io/luxon/#/math, https://moment.github.io/luxon/api-docs/index.html

## How we use it here
- One zone: `APP_ZONE = "Europe/Moscow"` (UTC+3, no DST) from `src/server/clock.ts`. Every `DateTime` the server reasons with is in this zone.
- "Now" is injected: route handlers call `now()` (honours `APP_NOW`) and pass `now: DateTime` down. Parsers and services never call `DateTime.now()` or `new Date()`.
- Storage: instants (reminders, meetings, timed tasks) as UTC ms (`toMillis()`); a date without time (AC-02, AC-03) as `YYYY-MM-DD`. Exact columns: `docs/architecture.md#data-model`.
- Periods are half-open `[from, to)` intervals of Moscow days; "на следующей неделе" = Monday 00:00 to next Monday 00:00 (AC-06).

## Do
- Create wall-clock times in the zone:
  ```ts
  DateTime.fromObject({ year: 2026, month: 10, day: 20, hour: 10 }, { zone: APP_ZONE });
  DateTime.fromISO("2026-10-20", { zone: APP_ZONE });          // date-only → midnight Moscow
  DateTime.fromMillis(row.startsAt.getTime(), { zone: APP_ZONE });
  ```
- Relative arithmetic on the injected `now`: `now.plus({ hours: 2 })`, `now.plus({ days: 1 }).startOf("day")`, `now.set({ hour: 15, minute: 0, second: 0, millisecond: 0 })`.
- Weeks are ISO (Monday first): `now.startOf("week")` → Monday 00:00; `now.endOf("week")` → Sunday 23:59:59.999 (verified: for 2026-10-19 gives 2026-10-19 .. 2026-10-25). "До конца недели" = `now.endOf("week").toISODate()`.
- Weekday names: `weekday` 1 = Monday … 7 = Sunday. "В пятницу" = the nearest future Friday (today counts only if the brief says so — it does not: on Monday 19.10 it is 23.10).
- Format for answers with Russian locale: `dt.setLocale("ru").toFormat("d MMMM")` → "20 октября"; time `toFormat("HH:mm")` → "10:00". Put formatters in `src/shared/format.ts` so UI and answers match.
- Compare by instants (`toMillis()`), or by `hasSame(other, "day")` for calendar days.
- Meeting conflicts: interval `[start, start + 1h)`; two meetings conflict when `a.start < b.end && b.start < a.end` (AC-14: 15:30 conflicts with 15:00, 16:00 does not).

## Don't
- No `new Date()`, `Date.now()`, `DateTime.now()` or `DateTime.local()` in business code — breaks APP_NOW and tests.
- Don't set `Settings.defaultZone` or `Settings.now` globally — pass zone and now explicitly.
- Don't use the machine's zone: CI and Vercel run in UTC. Always pass `{ zone: APP_ZONE }` or `setZone(APP_ZONE)`.
- Don't use `useLocaleWeeks` — Russian weeks are ISO anyway; keep defaults.
- Don't build ISO strings by hand; use `toISODate()`, `toISO()`.

## Testing
- Unit tests build `now` explicitly: `const NOW = DateTime.fromISO("2026-10-19T10:00:00", { zone: APP_ZONE });` (Monday, the AC reference moment) and assert `toISO()`/`toISODate()` strings.
- Cover month/year boundaries ("послезавтра" on 30.12) and late evening (`now` at 23:30 + "через два часа").

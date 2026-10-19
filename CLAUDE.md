# Project conventions

- Stack rules, commands and folder owners: `.crew/stack/README.md` (binding). Design: `docs/architecture.md`, decisions: `.crew/decisions/`.
- Next.js 16 App Router + TypeScript strict. Server logic lives in `src/server/**` as plain TS modules (no Next imports); `src/app/api/**` route handlers only parse, call a service and return JSON.
- Database: Drizzle + libSQL, schema in `src/db/schema.ts`, migrations in `drizzle/` via `npm run db:generate`; never edit generated migrations by hand.
- Every query on records filters by the current user's id; the user id comes only from the server-side session cookie.
- Time: Europe/Moscow everywhere; business functions take `now: DateTime` as a parameter; only API boundaries call `now()` from `src/server/clock.ts`.
- User-facing text is Russian; code, identifiers and commit messages are English.
- Before submitting: `npm run check` (lint, typecheck, unit tests) and, for UI flows, `npm run test:e2e`.

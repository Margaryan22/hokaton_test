# Stack

Chosen in ADR-001 (`.crew/decisions/ADR-001-*.md`). Node.js >= 22.12 (developed on 24.21), npm 11.

## Technologies
| Technology | Version | Used for | Rules | Docs |
|---|---|---|---|---|
| Next.js (App Router) | 16.4.2 | page, route handlers (`/api/*`), build | [nextjs.md](nextjs.md) | https://nextjs.org/docs/app |
| React | 19.3.0 | the single-page UI (client components) | [react-ui.md](react-ui.md) | https://react.dev/reference/react |
| TypeScript | 5.9 (strict) | everything | conventions below | https://www.typescriptlang.org/docs/ |
| Tailwind CSS | 4.3 | styles | [react-ui.md](react-ui.md) | https://tailwindcss.com/docs |
| Web Speech API | browser | speech-to-text, text-to-speech | [web-speech.md](web-speech.md) | https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API |
| Drizzle ORM + drizzle-kit | 0.45.4 / 0.31.11 | schema, queries, migrations | [drizzle-libsql.md](drizzle-libsql.md) | https://orm.drizzle.team/docs/overview |
| libSQL client (SQLite / Turso) | @libsql/client 0.18.0 | database driver: file locally, Turso hosted | [drizzle-libsql.md](drizzle-libsql.md) | https://docs.turso.tech/sdk/ts/reference |
| Luxon | 3.7.2 | dates and times in Europe/Moscow | [dates-luxon.md](dates-luxon.md) | https://moment.github.io/luxon/ |
| snowball-stemmers, fastest-levenshtein | 0.6.0 / 1.0.16 | Russian stemming, fuzzy match for NLU and search | [nlu-search.md](nlu-search.md) | https://snowballstem.org/algorithms/russian/stemmer.html |
| Zod | 4.6.7 | API input validation | [zod.md](zod.md) | https://zod.dev/api |
| Vitest | 5.0.5 | unit tests | [testing.md](testing.md) | https://vitest.dev/config/ |
| Playwright | 1.64.1 | end-to-end tests (Chromium) | [testing.md](testing.md) | https://playwright.dev/docs/test-webserver |
| ESLint + eslint-config-next | 9.39 / 16.4.2 | lint | — | https://nextjs.org/docs/app/api-reference/config/eslint |
| Vercel + Turso | Hobby / Free | hosting and the hosted database | [deploy.md](deploy.md) | https://vercel.com/docs/frameworks/nextjs |

## Commands
| Purpose | Command |
|---|---|
| Set up (deps, `data/app.db`, migrations, seed) | `npm run setup` |
| Dev server (http://localhost:3000) | `npm run dev` |
| Build / preview (http://localhost:3000) | `npm run build` then `npm run start`, or `npm run preview` |
| Unit tests | `npm run test` (one file: `npx vitest run src/server/nlu/dates.test.ts`) |
| End-to-end tests (own server on :3100, own DB, frozen clock) | `npm run test:e2e` (first time: `npx playwright install chromium`) |
| Lint / type check / both + unit tests | `npm run lint` / `npm run typecheck` / `npm run check` |
| New migration after editing `src/db/schema.ts` | `npm run db:generate -- --name <what>` |
| Apply migrations / seed | `npm run db:migrate` / `npm run db:seed` |
| Dependency audit (production deps) | `npm run audit` |

## Layout and owners
| Path | Owner | Notes |
|---|---|---|
| `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/favicon.ico` | frontend | the one page; client UI starts here |
| `src/components/**` | frontend | React components (`"use client"` where interactive) |
| `src/client/**` | frontend | browser-only code: speech hooks, API fetch wrappers, localStorage; unit tests `*.test.ts` beside the code |
| `public/**` | frontend | static files |
| `src/app/api/**` | backend | route handlers: parse with Zod, resolve user, call a service, return JSON |
| `src/server/**` | backend | NLU (`nlu/`), dates, search, services, dialog state, `clock.ts`; plain TS, no Next imports; tests beside the code |
| `src/shared/**` | backend | types and Zod schemas shared by client and server (API DTOs); no server imports |
| `src/db/**` | db | `schema.ts`, `client.ts`, `migrate.ts`, `seed.ts`, CSV import, repository helpers, db tests |
| `drizzle/**`, `drizzle.config.ts` | db | generated migrations (via `npm run db:generate` only) |
| `e2e/**`, `playwright.config.ts` | qa | acceptance tests, `prepare-db.ts` |
| `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `vitest.config.ts`, `vercel.json`, `.env.example`, `.gitignore`, `README.md`, `CLAUDE.md`, `AGENTS.md` (block re-added by `next dev`), `docs/**` | architect | shared settings and docs; ask the architect (via a task note) to add a package or setting |
| `.env` | backend, db | local only, git-ignored |
| `docs/source/**` | architect | input data (TZ, CSV) — read-only for everyone else |

## Conventions
1. Layers: voice (browser, `src/client`) → HTTP (`src/app/api`) → understanding (`src/server/nlu`) → business logic (`src/server/services`) → storage (`src/db`). A layer imports only the layers to its right; `src/server/nlu` never touches the database.
2. Every record query filters by `userId` taken from the session cookie on the server — never from the request body or a query string.
3. "Now" is a parameter (`now: DateTime` in Europe/Moscow). Only route handlers call `now()` from `src/server/clock.ts`; `APP_NOW` freezes it for tests.
4. Stored instants are UTC milliseconds; a task without time stores a date-only value (`YYYY-MM-DD`) — see `docs/architecture.md#data-model`.
5. All user-facing text (answers, labels, errors) is Russian; identifiers, logs, commits are English.
6. API responses are JSON; errors are `{ error: { code, message } }` with a 4xx/5xx status, message in Russian.
7. Normalise Russian text in one place (`src/server/nlu/normalize.ts`): lower-case, `ё`→`е`, collapse spaces, strip punctuation. Never rely on SQLite `lower()`/`LIKE` for Cyrillic — it folds ASCII only.
8. Business logic is test-first in Vitest; every phrase from an AC has a unit test of the parser and an e2e test of the full flow.
9. No new runtime dependency without an ADR; dev tooling only from `.crew/policy.json` `packages.allow`.
10. Files: kebab-case `.ts`, React components PascalCase `.tsx`; named exports; no default exports except Next.js files.

## Which rules to read when
- Building or changing the page, components, voice → react-ui.md, web-speech.md, nextjs.md
- Adding an API route → nextjs.md, zod.md, security.md
- Intent parsing, relative dates, search → nlu-search.md, dates-luxon.md, testing.md
- Schema, migrations, seed, queries → drizzle-libsql.md, dates-luxon.md
- Writing tests → testing.md
- Deployment, environment → deploy.md, security.md

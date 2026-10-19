# Drizzle ORM + libSQL (SQLite locally, Turso hosted)

## Version and sources
- drizzle-orm 0.45.4, drizzle-kit 0.31.11 (stable line; the `1.0.0-rc` docs on the site differ — check `node_modules/drizzle-orm/**/*.d.ts` when in doubt), @libsql/client 0.18.0.
- https://orm.drizzle.team/docs/get-started/turso-new, https://orm.drizzle.team/docs/connect-turso
- https://orm.drizzle.team/docs/column-types/sqlite, https://orm.drizzle.team/docs/migrations
- https://docs.turso.tech/sdk/ts/reference

## How we use it here
- `src/db/client.ts` creates one client from `DATABASE_URL` (+ `DATABASE_AUTH_TOKEN`) and exports `db` (Drizzle, with `schema`). Local `file:./data/app.db`; unit tests `file::memory:`; e2e `file:./data/e2e.db`; hosted `libsql://…turso.io`.
- `src/db/schema.ts` is the only schema file. Tables snake_case plural (`users`, `records`, `dialog_messages`); TS properties camelCase with explicit column names.
- Migrations: edit the schema → `npm run db:generate -- --name <what>` → commit `drizzle/*.sql` and `drizzle/meta/*`. Applied by `npm run db:migrate` (`src/db/migrate.ts`, `migrate(db, { migrationsFolder: "./drizzle" })`), also before every Vercel build.
- Seed (`src/db/seed.ts`) is idempotent: user "Демо" by unique name; CSV rows keyed by their CSV id (a unique `source_id` per owner) with `onConflictDoNothing` — rerunning creates no duplicates (AC-22).
- Data access lives in repository functions in `src/db/**` (e.g. `src/db/records.ts`) that take `userId` as a required first argument. Services in `src/server/**` call them.

## Do
- Column types (verified in the installed `.d.ts`):
  ```ts
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["task", "meeting", "reminder"] }).notNull(),   // enum = types only; validate with Zod too
  done: integer("done", { mode: "boolean" }).notNull().default(false),
  startsAt: integer("starts_at", { mode: "timestamp_ms" }),                    // UTC instant
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  ```
- Indexes and constraints in the third argument as an **array**: `(t) => [index("records_user_due_idx").on(t.userId, t.dueDate), uniqueIndex(...).on(...)]` (the object form is deprecated).
- Queries with the core builder: `db.select().from(records).where(and(eq(records.userId, userId), gte(records.startsAt, from), lt(records.startsAt, to))).orderBy(asc(records.startsAt))`.
- Inserts that need the row back: `.returning()`; upserts: `.onConflictDoNothing({ target: … })` / `.onConflictDoUpdate`.
- Bulk seed: chunked `db.insert(records).values(chunk)` (≈100 rows per statement) or `db.batch([...])` — one round trip per chunk matters on Turso.
- Multi-step writes (confirm + update + dialog state) in `db.transaction(async (tx) => { … })`.
- Types: `typeof records.$inferSelect` / `$inferInsert`; export them from `schema.ts`.

## Don't
- Don't edit generated SQL in `drizzle/` or delete migrations that are committed; add a new one.
- Don't use `drizzle-kit push` — always generate + migrate so the hosted DB gets the same SQL.
- Don't rely on SQLite `lower()`, `upper()` or `LIKE` for Cyrillic text (ASCII-only case folding). Search runs in TypeScript over normalised text (nlu-search.md).
- Don't store local wall-clock strings as instants. Instants are UTC ms; date-only values are `YYYY-MM-DD` text (see dates-luxon.md).
- Don't open a second client or call `createClient` elsewhere — import `db`.
- Don't import `src/db/**` from client components.

## Testing
- Vitest sets `DATABASE_URL=file::memory:` (vitest.config.ts); each test file runs in its own worker with its own empty database. Call a helper (e.g. `src/db/test-db.ts` → `await migrate(db, { migrationsFolder: "./drizzle" })` and clear tables in `beforeEach`). Transactions work on the in-memory DB (checked).
- Test that every repository function scopes by `userId` (Анна's records never returned for Борис — AC-20).

## Security
- Use the query builder or `sql\`…${value}\`` placeholders; never concatenate user text into SQL (`sql.raw` is forbidden for user input).
- `DATABASE_AUTH_TOKEN` lives only in env vars (Vercel settings / local `.env`), never in the repo or logs.

# Deploy: Vercel (Hobby) + Turso (Free)

## Sources
- https://vercel.com/docs/frameworks/nextjs, https://vercel.com/docs/project-configuration (vercel.json `buildCommand`, `regions`)
- https://docs.turso.tech/sdk/ts/reference, https://turso.tech/pricing (Free: 100 databases, 5 GB — checked 2026-10)

## How it works
- `vercel.json`: framework `nextjs`, region `fra1`, `buildCommand: npm run db:migrate && npm run db:seed && npm run build`. Migrations and the idempotent seed run against Turso on every deploy, so the hosted DB always matches `drizzle/`.
- Env vars in Vercel (Production + Preview): `DATABASE_URL=libsql://<db>-<org>.turso.io`, `DATABASE_AUTH_TOKEN=<token>`. Never `APP_NOW` in production.
- Data lives in Turso, so it survives cold starts and redeploys (AC-21). Serverless functions are stateless: **no module-level caches of user data or dialog state** — dialog context is stored in the database.
- The owner must create the Vercel and Turso accounts (`.crew/access-checklist.md`); until then README documents the steps and everything is checked locally.

## Do
- Keep server code Node-runtime only (no Edge) and free of filesystem writes at runtime (Vercel's filesystem is read-only except `/tmp`).
- Files read at runtime (none planned) must be imported, not read by relative path. The CSV is read only by the seed at build time (`docs/source/voice_assistant_events.csv`).
- Keep each request fast: one or two DB round trips per chat turn; load the user's records once per search.

## Don't
- Don't use `file:` URLs in production — the Vercel filesystem is ephemeral.
- Don't commit `.vercel/` or `.env`.

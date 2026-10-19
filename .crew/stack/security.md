# Security rules for this prototype

Sources: OWASP ASVS L1 basics, https://nextjs.org/docs/app/guides/data-security, https://nextjs.org/docs/app/api-reference/functions/cookies

## Model
- No passwords by design (brief: open link, users chosen by name). Isolation between users is still enforced on the server: Анна's records are never returned to Борис (AC-20). Names are not secrets; README warns not to enter personal data.

## Rules
1. **Current user**: `POST /api/session { name }` finds or creates the user and sets cookie `uid` (httpOnly, `sameSite: "lax"`, `path: "/"`, `secure` in production, 1 year). Every other API reads the user only from that cookie and checks it exists; no cookie → 401 `{ error: { code: "no_user", message: "Выберите пользователя" } }`.
2. **Scoping**: every repository function that reads or writes records/dialog takes `userId` and puts it in the `WHERE` clause — including update and delete by id (`where(and(eq(records.id, id), eq(records.userId, userId)))`). A record of another user behaves as "not found".
3. **Input**: every body/query is validated with Zod (zod.md); text length capped (500 chars for chat, 40 for names).
4. **SQL**: Drizzle builder or `sql` template placeholders only; no string concatenation, no `sql.raw` with user input.
5. **Output**: assistant answers are plain text rendered by React; no `dangerouslySetInnerHTML`.
6. **Errors**: return Russian messages with a code; never stack traces, SQL or env values. Log server errors with `console.error` (no user text beyond what is needed).
7. **Secrets**: `DATABASE_AUTH_TOKEN`, `LLM_API_KEY` only in env (`.env` is git-ignored; Vercel env settings). `.env.example` holds placeholders only. Nothing secret is sent to the browser.
8. **Destructive actions** need confirmation in the dialog (AC-15) and are applied only to the pending record stored server-side in the user's dialog state, never to an id supplied by the client in the confirmation.
9. **Dependencies**: `npm run audit` must show no high/critical in production deps (dev-only advisories in eslint-config-next and drizzle-kit are known and accepted, ADR-001).
10. **LLM (optional)**: the user's text goes to the provider only when the key is set; validate the model output with Zod and treat it as data, never as instructions to execute.

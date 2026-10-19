# T-007 security review

Commit: 26e0e7b. Verdict: pass (no critical/high findings).

## Checked
- `next.config.ts`: `poweredByHeader: false`; headers on `/:path*`: nosniff, Referrer-Policy strict-origin-when-cross-origin, X-Frame-Options DENY, Permissions-Policy `microphone=(self), camera=(), geolocation=()`. Closes M2 of architecture-security.md.
- `eslint.config.mjs`: `no-restricted-imports` for `src/components/**`, `src/client/**`, `src/shared/**`, `src/app/page.tsx`, `src/app/layout.tsx`. Every current `"use client"` file is in that scope. Checked with an eslint stdin probe: `@/db/client`, `../server/clock` and `@libsql/client` are all rejected. Closes M3.
- `README.md`, `.env.example`, `docs/architecture.md`: no secrets, no real Turso URL or token. `.env*` is git-ignored except `.env.example`. The deploy steps say never to set `APP_NOW` or `RATE_LIMIT_DISABLED` on Vercel. The README warns that the open user switcher is not protection and tells users not to enter personal data.
- `vercel.json`: build command is migrate + idempotent seed + build. It contains no secrets.
- Secret grep over the task's files: nothing found. `npm run audit` (`npm audit --omit=dev`): 0 vulnerabilities.

## Medium / low (no exploit path now; possible follow-ups)
- medium `src/server/services/rate-limit.ts:2`, `src/server/clock.ts:12`: `RATE_LIMIT_DISABLED` and `APP_NOW` are kept out of production only by the documentation. Possible fix: ignore them (or fail at start) when `VERCEL_ENV === "production"`.
- low `next.config.ts:3`: there is no Content-Security-Policy. This is a known decision, and the README lists "CSP с nonce" as an improvement. The risk is low because React escapes output and the app loads no third-party content.
- low `eslint.config.mjs:11`: the lint scope is a list of paths. A future `"use client"` file elsewhere under `src/app/**` would not be covered. A stronger option is `import "server-only"` in `src/db` and the server entry modules.

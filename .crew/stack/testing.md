# Testing: Vitest 5 (unit) and Playwright 1.64 (end-to-end)

## Version and sources
- vitest 5.0.5 — https://vitest.dev/config/ ; @playwright/test 1.64.1 — https://playwright.dev/docs/test-webserver, https://playwright.dev/docs/locators, https://playwright.dev/docs/api-testing

## How we use it here
- **Unit (Vitest)**: `src/**/*.test.ts(x)` beside the code, Node environment (`vitest.config.ts`). The config sets `APP_NOW=2026-10-19T10:00:00+03:00` and `DATABASE_URL=file::memory:`. `@/` resolves to `src/`. Owners write tests for their own folders (test-first).
- **End-to-end (Playwright)**: `e2e/*.spec.ts`, owned by QA, Chromium only, one worker (tests share one server and DB). `playwright.config.ts` starts `tsx e2e/prepare-db.ts && next dev --port 3100` with `DATABASE_URL=file:./data/e2e.db`, `APP_NOW=2026-10-19T10:00:00+03:00`, `NEXT_DIST_DIR=.next-e2e`; `prepare-db.ts` deletes, migrates and seeds that DB each run (so "Демо" has the 1000 CSV rows). Runs beside a dev server on :3000 without conflict.
- Smoke tests from the skeleton: `src/server/clock.test.ts`, `e2e/smoke.spec.ts`.

## Do
- Vitest: `import { describe, expect, it, beforeEach } from "vitest";` Table-driven tests with `it.each([...])("%s", …)` for phrase → intent.
- Build `now` in the test (`DateTime.fromISO("2026-10-19T10:00:00", { zone: "Europe/Moscow" })`) rather than relying on env.
- DB tests: migrate the in-memory DB once per file, clear tables in `beforeEach`, create users "Анна"/"Борис" explicitly.
- Playwright: locate by role and label (`page.getByRole("button", { name: "Отправить" })`, `page.getByLabel("Сообщение")`, `page.getByText("Звук: вкл")`); assert with web-first `await expect(locator).toBeVisible()` / `toHaveText`.
- Isolate e2e data per test with a unique user name (`Анна-${test.info().testId}`) unless the AC names the user; tests on "Демо" must not modify its records.
- Drive the assistant through the text input (headless Chromium has no speech recognition). For TTS assertions stub synthesis: `page.addInitScript(() => { window.__spoken = []; window.speechSynthesis.speak = (u) => window.__spoken.push(u.text); })`.
- API-level checks (AC-20 isolation, AC-21 persistence) can use the `request` fixture with the session cookie; restart-survival is covered by data in the file DB, not by restarting inside a test.
- Name tests after the AC: `test("AC-05 asks for meeting time and saves after the answer", …)`.

## Don't
- No `page.waitForTimeout` / sleeps; wait on locators or responses (`page.waitForResponse("**/api/chat")`).
- No CSS/XPath selectors tied to Tailwind classes.
- Don't call real `DateTime.now()` in assertions — the server's clock is frozen at 2026-10-19 10:00 MSK.
- Don't run e2e against `data/app.db` (prepare-db refuses non-e2e URLs).
- No test may need an API key or network service — AC-23 requires the keyless path (ADR-007).

## Commands
- `npm run test` · `npx vitest run src/server/nlu` · `npm run test:e2e` · `npx playwright test e2e/booking.spec.ts -g "AC-05"` · first time `npx playwright install chromium`.

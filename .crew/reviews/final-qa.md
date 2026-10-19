# Final QA

Date 2026-10-19, HEAD fa39b0c. Verdict: PASS.

## Commands
| Command | Result |
|---|---|
| `npm run check` (lint, typecheck, unit) | lint clean, typecheck clean, vitest 15 files / 293 tests passed, 0 failed |
| `npm run test:e2e` | 56 passed, 0 failed, 0 skipped (11.7 s) |
| Fresh clone (`git clone` into scratchpad, `npm run setup`) | deps, migrations, seed OK: "user «Демо» (id 1), 1000 of 1000 CSV rows inserted"; `git status` clean afterwards |
| `next dev` in the fresh clone | `/api/health` ok, `/` 200, session «Демо», «Что было 26 января 2024?» returns ids 14, 15, 16 |
| `git status` in the main repo after all runs | clean |

## Acceptance criteria
| AC | Test (file, name prefix) | Result |
|---|---|---|
| AC-01 | e2e/create.spec.ts "AC-01 reminder for tomorrow 10:00..." | pass |
| AC-02 | e2e/create.spec.ts "AC-02 task for Friday..." | pass |
| AC-03 | e2e/create.spec.ts "AC-03 ... until the end of the week..." | pass |
| AC-04 | e2e/create.spec.ts "AC-04 meetings are created..." | pass |
| AC-05 | e2e/create.spec.ts "AC-05 meeting without a time..." | pass |
| AC-06 | e2e/create.spec.ts "AC-06 relative dates..." | pass |
| AC-07 | e2e/lists.spec.ts "AC-07 three phrasings..." | pass |
| AC-08 | e2e/lists.spec.ts "AC-08 tasks for tomorrow only..." and "AC-08 'are there meetings today'..." | pass |
| AC-09 | e2e/lists.spec.ts "AC-09 empty period..." | pass |
| AC-10 | e2e/search.spec.ts "AC-10 (a)" and "AC-10 (b)" | pass |
| AC-11 | e2e/search.spec.ts "AC-11 (a)" and "AC-11 (b)" | pass |
| AC-12 | e2e/search.spec.ts "AC-12 nothing found..." | pass |
| AC-13 | e2e/dialog.spec.ts "AC-13 unrecognised phrase..." | pass |
| AC-14 | e2e/dialog.spec.ts 4 tests (same time yes, no, 15:30 overlap, 16:00 free) | pass |
| AC-15 | e2e/dialog.spec.ts "AC-15 complete...delete asks first..." and "'нет' keeps the record" | pass |
| AC-16 | e2e/dialog.spec.ts 2 tests (move after create, new dialog asks) | pass |
| AC-17 | e2e/dialog.spec.ts "AC-17 several matches..." | pass |
| AC-18 | e2e/ui.spec.ts 2 tests (elements and speech on; sound off persists after reload) | pass |
| AC-19 | e2e/ui.spec.ts 2 tests (no recognition; permission denied) | pass |
| AC-20 | e2e/ui.spec.ts 2 tests (UI isolation; API isolation and 401) | pass |
| AC-21 | e2e/ui.spec.ts "AC-21 a created record and the dialog survive a reload..." | pass |
| AC-22 | e2e/search.spec.ts 4 tests (26 Jan 2024 ids 14/15/16, full import spot checks, type rule, other user) | pass |
| AC-23 | e2e/keyless-docs.spec.ts "AC-23 no paid API key..." | pass |
| AC-24 | e2e/keyless-docs.spec.ts "AC-24 README ... architecture doc..." | pass (README placeholders for the repo and prototype links remain by design, see brief Risks) |

Extra: e2e/paraphrases.spec.ts (13 tests), e2e/smoke.spec.ts (3), e2e/visual.spec.ts (2) all pass.

Limits: AC-21 restart-of-server and hosted "sleep" are covered locally by the new-browser-session test; the hosted Turso case is not verifiable without hosting access.

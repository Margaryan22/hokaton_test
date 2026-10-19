# Lessons

What earlier runs learned the hard way, newest last. One line each: `- [role] lesson (date)`.

- [qa] Run the e2e web server as a production build (build then start) instead of a dev server with a custom build dir, and keep a smoke test that asserts the page becomes interactive after sign-in. (2026-10-19)
- [backend] When adding a rate limit or a test-only env override (frozen clock, disabled limits), add the test switch and a production guard in the same task so e2e suites from one IP keep working and the override can never apply in production. (2026-10-19)
- [all] Never start ad-hoc dev servers with a custom build directory: the framework rewrites shared config files such as tsconfig.json; use the project's test configuration instead. (2026-10-19)
- [architect] Split stack setup into skeleton-and-commands first and stack rules second, committing after each, so a long setup does not hit the agent's turn limit mid-way. (2026-10-19)

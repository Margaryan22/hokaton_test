---
phase: done
updated_at: "2026-10-19T14:02:10Z"
active_tasks: ["T-010"]
summary: "Прототип готов: 12/12 задач, 293 unit + 56/56 e2e, все AC выполнены; нужен деплой и ссылки в README"
---

# Status

Готово 8 из 11: T-001 схема БД, T-002 DTO и NLU-парсер, T-003 поиск, T-004 сервисы и API, T-005 диалог, T-006 главная страница, T-008 лимиты, T-009 фикс e2e-сервера. На проверке T-010 (qa). Далее T-007, T-011. Эскалаций нет.

## Progress
- Done: T-001 DB schema, repositories and CSV seed for «Демо»; T-002 Shared DTOs and Russian NLU parser; T-003 Search ranking and target resolution; T-004 Record services, session/users/records API; T-005 Dialog engine, replies and chat/dialog API; T-006 Main page UI: switcher, dialog, voice, records; T-008 Rate limits switchable for tests via RATE_LIMIT_DISABLED; T-009 Fix e2e dev server: HMR reload loop with NEXT_DIST_DIR
- In review: T-010 NLU robustness: paraphrases from QA probes (qa)
- Next: T-007 README, security headers, import boundary lint rule (architect); T-011 Visual polish from T-006 QA notes (frontend)
- Blocked: none

## Spend
Budget cap: none. Used: $13.09 (plugin estimate at API list prices), ~16334693 tokens estimated.

---
id: ADR-006
title: "Импорт CSV: тип по началу текста, идемпотентность через уникальный (user_id, source_id)"
status: accepted
date: 2026-10-19
---

# ADR-006: Импорт CSV: тип по началу текста, идемпотентность через уникальный (user_id, source_id)

## Context
AC-22: у «Демо» после первого запуска 1000 записей из `docs/source/voice_assistant_events.csv`, повторный запуск не создаёт дублей, типы — по правилу из брифа (Data). Сид запускается при `npm run setup`, в e2e и перед каждой сборкой на Vercel.

## Decision
- `src/db/csv-import.ts`: `parseCsv(text)` (снять BOM, разделитель `,`, 4 колонки `id,date,time,text`; в файле нет кавычек — проверено), `classifyCsvText(text)`, `importCsv(db, userId, rows, importedAt)`.
- Правило типа на `t = lower(text).replace("ё","е").trim()`: `t` начинается с «встреч», «созвон» или «демо», либо содержит «планерк» → meeting; иначе начинается с «напомн» → reminder; иначе task.
- Запись: `title` = текст как есть; `due_date` = date; `starts_at` = date+time в Europe/Moscow → UTC мс; `done=false`; `source_id` = CSV id; `created_at` = момент импорта.
- Идемпотентность: уникальный индекс `records(user_id, source_id)` + `onConflictDoNothing`; пользователь «Демо» — по уникальному `name_key`. Вставка пачками по 100.

## Alternatives
- Флаг «импорт выполнен» — не чинит частично прерванный импорт.
- Удалить и вставить заново — меняет id записей и стирает изменения проверяющего при каждом деплое.

## Consequences
- Удалённая проверяющим запись «Демо» вернётся при следующем сиде/деплое — допустимо для демо-данных.
- Тесты поиска импортируют тот же CSV через `importCsv` в in-memory БД.

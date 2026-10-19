# Understanding requests (NLU) and search — rules, stemming, fuzzy match

## Version and sources
- snowball-stemmers 0.6.0 (+ @types/snowball-stemmers 0.6.2), fastest-levenshtein 1.0.16. No paid API, no model download.
- Snowball Russian algorithm: https://snowballstem.org/algorithms/russian/stemmer.html; package: https://github.com/mazko/jssnowball
- fastest-levenshtein: https://github.com/ka-weihe/fastest-levenshtein
- Optional LLM: only through `fetch`, see "Optional LLM" below. ADR-001.

## How we use it here
- `src/server/nlu/` turns a Russian utterance + dialog context + `now` into a typed `Intent` (discriminated union: `create`, `list`, `search`, `update`, `complete`, `delete`, `confirm`, `choose`, `answer_time`, `unknown`). It never touches the database.
- Pipeline: `normalize(text)` → token list → intent detection by ordered rules (keyword/regex patterns) → slot extraction (kind, title, date, time, period, filters) → `Intent`. Each step is a pure function with its own test file.
- Dates/times in phrases are extracted by `src/server/nlu/dates.ts` (rules for "завтра", "послезавтра", "в пятницу", "через два часа", "до конца недели", "на следующей неделе", "в 10 утра", "в 14:30", "26 января 2024"…) using Luxon (dates-luxon.md). Numbers in words ("два", "пятнадцать") are converted in `normalize`.
- Search (`src/server/search/`): records of the current user are scored in memory (≈1000 rows — fast enough per request): tokens → stems → synonym expansion → match against stems of each record's text, with a small fuzzy bonus. Filters (kind, past/future relative to `now`) are applied before ranking. Ties → earlier date first; limit 5 (AC-10..AC-12).

## Do
- Normalise once (`normalize.ts`): `toLowerCase()`, `ё`→`е`, punctuation → space, collapse spaces. Stem **after** `ё`→`е` (the stemmer treats them differently: "отчёты"→"отчёт" but "отчеты"→"отчет").
  ```ts
  import { newStemmer } from "snowball-stemmers";
  const ru = newStemmer("russian");
  ru.stem("презентацию"); // "презентац"   ru.stem("договору"); // "договор"   ru.stem("Иваном".toLowerCase()); // "иван"
  ```
- Keep a stop-word list (служебные слова: "я", "мне", "у", "по", "про", "найди", "задачу"…) so command words do not count as search terms.
- Keep synonyms as data in `src/server/search/synonyms.ts` (groups of stems: "созвон"/"звонок"/"встреч"; "отчет"/"доклад"; "договор"/"контракт"). Each group is unit-tested with a phrase.
- Fuzzy match only for tokens of ≥5 letters and distance ≤1 (≤2 for ≥9 letters) using `distance(a, b)`; it is a tie-breaker, never stronger than an exact stem match.
- Type words in a search query ("задачу", "встречу", "напоминание") become a **filter**, not a search term (AC-10б: "найди задачу про презентацию" returns only tasks).
- Tense: "была/было/ставил" → past (before `now`), "будет/запланирована" → future (brief, Assumptions).
- Rules ordered from specific to general; the first matching rule wins; every rule has a named test with the AC phrase.
- Anything not understood → `{ type: "unknown" }`; the service answers with "не понял" + 2–3 example phrases (AC-13). Missing required slot → a clarification question, nothing saved (AC-05).

## Don't
- No regex over raw text with `\b` for Cyrillic — JS `\b` is ASCII-only. Tokenise on spaces after `normalize`, or use `(?<![\p{L}])…(?![\p{L}])` with the `u` flag.
- No SQL `LIKE` search for Russian (case folding is ASCII-only); no full-text extension.
- No embeddings, model downloads or external NLP services (ADR-001).
- Don't let the parser guess a meeting time; ask (AC-05). Don't ask about time for tasks (AC-02).
- Don't mutate shared state in the parser — it must be deterministic for the same `(text, context, now)`.

## Optional LLM
- Only if `LLM_API_KEY` is set, and only as a fallback for `unknown` intents: call the provider with `fetch` (timeout 5 s), ask for the same `Intent` JSON, validate it with the Zod `IntentSchema`; on any error or invalid JSON fall back to `unknown`. Never required by any test; e2e and unit tests run with the key empty (AC-23). No SDK package.

## Testing
- Table-driven Vitest tests: `[phrase, expectedIntent]` for every AC phrase plus 2–3 paraphrases each, with `now = 2026-10-19T10:00 Europe/Moscow`.
- Search tests load the real CSV (`docs/source/voice_assistant_events.csv`) through the same import/type rule as the seed and assert AC-10, AC-11, AC-12, AC-22 ids.

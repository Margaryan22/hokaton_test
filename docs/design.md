# Design

Brief: `.crew/brief.md`. Pages and elements: `docs/architecture.md#9-клиент`. Styles: Tailwind 4, tokens in `@theme` in `src/app/globals.css` (`.crew/stack/react-ui.md`). Names of buttons, fields and messages are fixed by the brief and the architecture; this file only decides look and place.

## Character
Calm, clear, tool-like. A reviewer opens the link on a laptop or phone, talks to the assistant for a few minutes and judges whether it is understandable and reliable. Light, quiet surfaces, one blue accent, generous spacing; the dialog is the hero, the records list is its proof.

## Colour
Tokens in `@theme` as `--color-*`; screens use only these (no one-off hex).

| Token | Value | Used for | Contrast |
|---|---|---|---|
| `bg` | #F4F6F9 | page background | — |
| `surface` | #FFFFFF | cards, panels, inputs | — |
| `surface-alt` | #EEF1F6 | assistant bubble, hover rows, chips | — |
| `border` | #CBD2DC | dividers, input borders (3:1 vs surface for UI edges) | 1.5:1 decor; input border uses `border-strong` |
| `border-strong` | #7C8797 | input and button outlines | 3.6:1 on surface |
| `text` | #18212F | body | 16:1 on surface, 14.7:1 on bg |
| `muted` | #566275 | secondary text, dates, placeholders, done rows | 6.2:1 on surface, 5.7:1 on bg, 5.3:1 on surface-alt |
| `primary` | #2447B5 | Send button, user bubble, focus ring, active state | white on it 8.3:1 |
| `primary-hover` | #1B3A99 | hover | white 10.5:1 |
| `on-primary` | #FFFFFF | text on primary | |
| `primary-soft` | #E3EAFB | selected user in switcher, panel title strip | text on it 13:1 |
| `danger` | #B42318 | mic listening state, error alert text/border | 6.5:1 on surface |
| `danger-soft` | #FDECEA | error alert background | danger on it 5.7:1 |
| `success` | #0B6B3F | done badge, success flash | 6.3:1 on surface |
| `success-soft` | #E4F4EA | done badge background | success on it 5.6:1 |
| `warning` | #8A5200 | "Голосовой ввод недоступен" notice text | 6.4:1 on warning-soft |
| `warning-soft` | #FFF4DC | notice background | |

Kind chips (task / meeting / reminder) are `surface-alt` with `text`, distinguished by their Russian label and a small inline SVG shape, never by colour alone.

## Type and spacing
- Font: system stack `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` (`--font-sans`). No webfonts.
- Scale: 12 / 14 / 16 / 20 / 24 px (`text-xs`, `sm`, `base`, `xl`, `2xl`). Body and bubbles 16 (also stops iOS zoom in inputs); dates and chips 14; chips/captions 12 at weight 600 only; panel and page titles 20; app title 24 weight 700. Line height 1.5; weights 400 / 600 / 700.
- Spacing unit 4px (Tailwind default); common steps 8, 12, 16, 24. Page padding 16 on phone, 24 on desktop.
- Radius: 12px for cards, panels, bubbles, inputs, buttons; 999px for chips and the mic button.
- Touch targets: at least 44x44 px for every button, checkbox row and switcher item; mic button 56x56.
- Shadow: one, `0 1px 2px rgb(24 33 47 / 0.08)`, on cards only.

## Components
All interactive: visible focus = 2px `primary` outline with 2px offset (`focus-visible`), never removed. Disabled = 50% opacity plus `cursor-not-allowed` plus `disabled` attribute; text still meets 4.5:1 is not required for disabled, but the reason is always shown as text next to it.

**Button primary** (Отправить): `primary` bg, `on-primary` text, 44px high, padding 16, weight 600. States: hover `primary-hover`; focus ring; disabled (empty input or in flight); busy = text stays «Отправить», a 16px spinning ring (inline SVG, `aria-hidden`) replaces nothing but sits left of it, button disabled and `aria-busy="true"`.

**Button secondary** (Новый диалог, Создать/Войти in switcher, Звук): `surface` bg, 1px `border-strong`, `text`; hover `surface-alt`; same focus/disabled/busy rules. No danger buttons exist on the page (deleting is done by dialog confirmation).

**Sound toggle**: secondary button whose visible text is exactly «Звук: вкл» / «Звук: выкл», with a small speaker SVG left of it (waves when on, a cross when off, `aria-hidden`). `aria-pressed` = on. On state: `primary-soft` bg and `primary` text with 1px `primary` border; off: secondary look. State is also readable from the text, not from colour.

**Mic button**: circle 56px, `primary` bg, white microphone SVG, `aria-label="Записать голос"`. States:
- idle: as above; hover `primary-hover`.
- listening: `danger` bg, white square-stop SVG, `aria-label="Остановить запись"`, `aria-pressed=true`, a pulsing ring (`danger` at 30% opacity, 1.2s; disabled under `prefers-reduced-motion`, replaced by static ring) and next to it the text «Слушаю…» (`danger`, weight 600, `role="status"`). Interim transcript is shown in the text field in `muted` italic.
- unavailable (AC-19: no support or permission denied): `surface-alt` bg, `muted` crossed-out mic SVG, `disabled`, and beside/under it a notice block (warning-soft, warning text, 14px) with exactly «Голосовой ввод недоступен, введите текст» (`role="status"`). The text field and Send stay fully active and take focus.
- busy (waiting for the server after a spoken phrase): mic disabled, spinner ring around it.

**Field with label**: label above, 14px weight 600 `text`; input 44px high, `surface` bg, 1px `border-strong`, radius 12, padding 12; placeholder `muted`; focus = ring; error = border `danger` plus message below in `danger` 14px with a small "!" SVG, linked by `aria-describedby`. The chat field has a visible label «Сообщение» (not placeholder-only), Enter submits.

**User switcher** (card at the top of the left column on desktop; a compact bar on phone): label «Пользователь» + a native `<select>` of names (44px, current name selected) — fast and accessible on phones — and below it the field «Новое имя» (max 40) with a secondary button that creates and switches in one action. Current user's name is also shown in the header in `primary-soft` chip. Error (empty or too long name): field error text from the server.

**Dialog feed**: a scrollable list (`role="log"`, `aria-live="polite"`) of bubbles. User bubble: right-aligned, `primary` bg, white text, radius 12 with a 4px bottom-right corner, max width 85%. Assistant bubble: left-aligned, `surface-alt` bg, `text`, 4px bottom-left corner, max 85%. Line breaks preserved (`whitespace-pre-wrap`); assistant lists such as «1. … 2. …» stay as plain text. A small 12px `muted` caption above each group says «Вы» / «Ассистент» (so the speaker is not told by colour/side alone). Auto-scrolls to the newest bubble. A pending assistant reply is a bubble with three pulsing dots and `aria-label="Ассистент отвечает"`.

**Records list** (panel «Записи»): title row (panel `title` from the API, 20px) with count «N» in a chip when `total` > shown. Each record is a row (min height 56) inside one card with 1px `border` separators:
- left: checkbox (24px visual, 44px hit area) with `aria-label` «Отметить выполненной: <название>»;
- centre: title 16px `text`; below it a 14px `muted` line «<дата>, <время>» (formatter from `src/shared/format.ts`; no time → only date; no date → «Без срока»);
- right/top: kind chip («Задача», «Встреча», «Напоминание», with its SVG shape: check-square, calendar, bell) and status text.
- Status is always text: not done = nothing extra besides unchecked box; done = `success` badge «Выполнено» with a check SVG.
- Done styling: title gets `line-through`, colour `muted`, chip and date stay readable (all ≥4.5:1); the row background stays `surface`.
- Row hover: `surface-alt`. Overdue is not styled (out of scope).
- Changing a checkbox: row shows 50% opacity and the checkbox disabled while the PATCH is in flight; on failure the box returns and an inline error alert appears above the list.

**Alert** (error / info): block with 1px border, radius 12, padding 12, icon + text. Error: `danger-soft` bg, `danger` text and border, `role="alert"`. Success flash (rare, e.g. user switched): `success-soft` / `success`, `role="status"`, disappears after 4 s. Notice (mic unavailable): warning colours.

**Empty state**: centred block inside the card: simple SVG outline (calendar), a 16px `text` sentence, a 14px `muted` hint with an example phrase. No button.

**Confirmation**: there is no modal. Confirmations («Удалить задачу «…»?», «Всё равно поставить?») are assistant bubbles; below the bubble when `awaiting` is `yes_no` two secondary quick-reply buttons «Да» and «Нет» appear (they send the same text as typing). For `choice` a numbered quick-reply button per option («1», «2», …). Quick replies disappear once answered.

## Layouts
**Desktop (>= 1024px)**: page max width 1200 centred, `bg` background. Header row: app title «Голосовой ассистент» (24px) on the left; right side: user chip, sound toggle, «Новый диалог». Below, two columns with 24 gap: left 60% = dialog card (feed fills available height, min 480, max `calc(100dvh - 200px)` with inner scroll; the composer pinned at the bottom of the card: row of [mic 56] [field «Сообщение» flex-1] [Отправить]; mic notice sits above the composer). Right 40% = stack of the user switcher card and the «Записи» card (records scroll inside, up to the same height).

**Tablet (640–1023)**: single column, order: header, switcher, dialog (height 60dvh), records.

**Phone (375, < 640)**: single column, padding 16. Order: header (title 20px; below it a row with user chip, sound toggle, «Новый диалог» that wraps to two lines as needed, each 44px high), switcher (collapsed to select + «Новое имя» stacked, full width), dialog card (height `min(60dvh, 520px)`, feed scrolls inside), composer stacked: field full width on the first line, second line [mic 56] [Отправить flex-1]. Then the «Записи» card (page scrolls). No horizontal scroll: bubbles max 90%, long titles wrap (`break-words`), the date line wraps under the title. Mic notice text wraps under the mic row.

## States
| Area | Loading | Empty | Error | Success |
|---|---|---|---|---|
| Page load (session, dialog, records) | skeleton: grey `surface-alt` bars in feed (3 bubbles) and list (4 rows), `aria-busy` | — | error alert «Не удалось загрузить данные. Обновите страницу.» with secondary «Повторить» | content |
| No user selected (401 `no_user`) | — | card «Выберите пользователя или введите новое имя» above the switcher; chat and mic disabled with that reason as text | server message in alert | after choosing, page loads |
| Dialog feed | pending-reply bubble (dots) | assistant-style hint bubble (not stored): «Скажите или напишите, например: «Напомни завтра в 10 позвонить Ивану»» | assistant bubble for the failed send replaced by an error alert under the composer «Не удалось отправить. Повторите.»; typed text kept | new bubbles appear, feed scrolls |
| Composer | Send disabled + busy, field readonly, text kept until success | Send disabled, hint nothing | field error (empty/over 500 chars: counter «N/500» in `danger` 14px from 450) | field cleared, focus returns to field |
| Records list | skeleton rows | empty state: «Записей пока нет» + hint «Попросите ассистента создать задачу»; for a period/search result with nothing: «Ничего не найдено» / the panel title shows the period | alert above list «Не удалось обновить записи» with «Повторить» | rows; a record just created/changed gets `primary-soft` background for 2 s (also announced by the assistant bubble, so no reliance on colour) |
| User switch | list shows skeleton, feed too | new user: empty feed hint + records empty state | field error under «Новое имя» | success flash «Пользователь: <имя>» |
| Mic | busy ring | — | permission denied or no support → unavailable state with notice | transcript lands in the field and is sent |
| Sound | — | — | If speech synthesis is missing: toggle stays, answers are text only (no extra error) | state persists after reload |

Reduced motion: pulsing, spinner speed-up and the 2s highlight fade are static under `prefers-reduced-motion: reduce`.

## Frontend watch list
- Sound toggle text must be exactly «Звук: вкл» / «Звук: выкл»; do not add words to the button's visible text (the icon is `aria-hidden`).
- Mic notice must be exactly «Голосовой ввод недоступен, введите текст»; mic and notice are chosen with `useSyncExternalStore` (server snapshot = supported, to avoid flicker mismatch, then correct on hydration).
- Use `100dvh` not `100vh` so the phone browser bar does not hide the composer; check at 375 for no sideways scroll.
- Everything new that this file does not cover: extend these tokens and components, mention it in the task result.

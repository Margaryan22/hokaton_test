# Visual review

Screenshots from `e2e/visual.spec.ts` in `test-results/visual/` (not committed): desktop-empty, desktop-filled (1280), phone-empty, phone-filled (375). All four were opened and checked against `docs/design.md`. Both viewports pass the no-horizontal-scroll check. Verdict: no blocking problems, no reject.

## Main page, desktop 1280 (desktop-empty.png, desktop-filled.png)
Right:
- Header with title, user chip, "Звук: вкл" (primary-soft, on state readable from the text) and "Новый диалог". Two columns: dialog about 60%, switcher and "Записи" about 40%, as in the design.
- Bubbles: user on the right in primary, assistant on the left in surface-alt, with "Вы" / "Ассистент" captions. The composer is pinned at the bottom: mic 56px, labelled "Сообщение", "Отправить". Send is dimmed while the field is empty, as designed.
- Records card: kind chips with an icon (bell, check-square), a "Без срока" fallback, and an empty state with a calendar icon, a sentence and an example hint.
- Nothing overlaps or is cut off. Contrast looks fine.

Minor, not blocking:
1. desktop-filled: the feed is scrolled to the newest bubble, so the first visible assistant bubble has no "Ассистент" caption above it (it is scrolled out). This is expected for a scrolling feed.
2. The right column ends well above the bottom of the dialog card, leaving blank space under "Записи" when it has few rows. It matches the layout and looks calm.
3. The records panel title is "Ближайшие", not "Записи" as design.md says. The title comes from the API (design.md: "panel title from the API"), so this is fine.

## Main page, phone 375 (phone-empty.png, phone-filled.png)
Right:
- Single column in the order header, switcher, dialog, records. No sideways scroll.
- Targets are at least 44px: the select, "Создать", the mic (56px) and Send. The text wraps cleanly inside bubbles. The records rows keep the chip and the date readable.

Minor, not blocking:
1. The header wraps to three rows (title; user chip and sound toggle; "Новый диалог"), which pushes the dialog about 370px down. Moving the switcher below the dialog, or putting the controls in one row, would give the dialog more room. The design calls the switcher "a compact bar on phone", and this one is a full card.
2. In phone-filled the feed starts mid-bubble ("молоко» без срока" is clipped at the top). This is the scroll position, not a layout bug.
3. "Создать" is dimmed while its field is empty, as designed, and is slightly low-contrast. A disabled control is exempt from the 4.5:1 rule.

## States not covered by screenshots
The mic-unavailable notice, the listening state, quick-reply buttons and the error alert are exercised by e2e tests (AC-19, AC-14, AC-17) but were not screenshotted, since `visual.spec.ts` only captures the empty and filled states.

# React 19 UI and Tailwind CSS 4

## Version and sources
- react / react-dom 19.3.0, tailwindcss 4.3 (via `@tailwindcss/turbopack`, config in `src/app/globals.css`).
- https://react.dev/reference/react (hooks), https://react.dev/reference/react-dom/components/input
- https://tailwindcss.com/docs/theme (CSS-first `@theme`), https://tailwindcss.com/docs/styling-with-utility-classes
- Look and feel: `docs/design.md` when the designer has written it.

## How we use it here
- One screen (AC-18): voice button, text field with "Отправить", dialog feed, records list, user switcher, sound toggle "Звук: вкл"/"Звук: выкл".
- `src/app/page.tsx` (server component) renders `<AssistantApp />` (`src/components/AssistantApp.tsx`, `"use client"`). Everything interactive is a client component.
- Data access from the browser goes through typed wrappers in `src/client/api.ts` (`fetch("/api/…")`), using DTO types from `src/shared/**`.
- Browser-only state: sound on/off in `localStorage` (key `va:sound`), wrapped in `src/client/preferences.ts`.
- Styling: Tailwind utility classes in JSX; design tokens (colours, fonts) as CSS variables in `@theme` inside `globals.css`. No CSS-in-JS, no component library.

## Do
- Keep server state in one place: after each chat reply, refresh the records list from the response or with one `GET /api/records`; do not keep a second hand-edited copy.
- Read browser-only values (`localStorage`, `window.SpeechRecognition`) with `useSyncExternalStore` and a server snapshot — the first render happens on the server. The lint rule `react-hooks/set-state-in-effect` (eslint-plugin-react-hooks 7) **fails** on `useEffect(() => setX(read()), [])`; setState inside event callbacks registered in an effect is fine. Checked against the skeleton's lint and types:
  ```tsx
  // src/client/preferences.ts
  const listeners = new Set<() => void>();
  export function subscribeSound(cb: () => void) {
    listeners.add(cb); window.addEventListener("storage", cb);
    return () => { listeners.delete(cb); window.removeEventListener("storage", cb); };
  }
  export const readSound = () => localStorage.getItem("va:sound") !== "off";
  export function writeSound(on: boolean) { localStorage.setItem("va:sound", on ? "on" : "off"); listeners.forEach((l) => l()); }
  // component
  const soundOn = useSyncExternalStore(subscribeSound, readSound, () => true); // default "вкл"
  ```
- Accessible controls: real `<button>`/`<input>`/`<label>`; the sound toggle is a button whose visible text is exactly "Звук: вкл"/"Звук: выкл"; the mic button has an `aria-label`; the dialog feed is a list with `aria-live="polite"`.
- Show pending state while a request is in flight (disable Send, keep the typed text until success).
- Render dates with the formatter from `src/shared/format.ts` (Russian, Moscow) so the list and the answers agree.
- Use stable keys (`record.id`, `message.id`), never array indexes, for lists that change.
- Submit the text form on Enter via `<form onSubmit>`; `event.preventDefault()`.

## Don't
- No `dangerouslySetInnerHTML` — assistant answers are plain text.
- No business logic in components (date parsing, intent rules, filtering by type): the server decides, the UI shows.
- Don't call `fetch` directly from many components — use `src/client/api.ts`.
- Don't use `useEffect` to derive state you can compute during render.
- Don't add UI libraries, icon packs or fonts without an ADR; inline SVG is fine.

## Testing
- Pure browser helpers (`src/client/*.ts`, e.g. preference storage with an injected `Storage`) get Vitest tests beside them.
- Screens and flows are covered by Playwright e2e (QA); use labels/roles the tests can find: `getByRole("button", { name: "Отправить" })`, `getByLabel("Сообщение")`.

## Security
- Treat every string from the API as text (React escapes it). Never build HTML from it.
- The user switcher only sends a name; the server sets the cookie.

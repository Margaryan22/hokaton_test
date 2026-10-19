# Web Speech API (browser STT and TTS)

## Version and sources
- Browser API, no package. Types: `@types/dom-speech-recognition` 0.0.12 (dev).
- https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API
- https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognitionErrorEvent/error
- https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisUtterance/lang

## How we use it here
- Speech-to-text: `src/client/speech/recognition.ts` (hook `useSpeechRecognition`). The final transcript is sent to the server exactly like typed text (same `/api/chat` call); the server never knows which input was used.
- Text-to-speech: `src/client/speech/synthesis.ts` (`speak(text)`), called for each assistant answer only when the sound toggle is "вкл" (AC-18).
- Unsupported browser or denied microphone (AC-19): the mic button is disabled and the page shows "Голосовой ввод недоступен, введите текст"; text input keeps working.

## Do
- Feature-detect with the prefixed fallback via `useSyncExternalStore` (server snapshot `false`), not with a synchronous `setState` in an effect — lint rule `react-hooks/set-state-in-effect` rejects that (see react-ui.md):
  ```ts
  const noop = () => () => {};
  const supported = useSyncExternalStore(noop, () => Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition), () => false);
  ```
  Create the recogniser on the mic button press (or in an effect keyed on `supported`); setState inside its callbacks is fine:
  ```ts
  const recognition = new (window.SpeechRecognition ?? window.webkitSpeechRecognition)();
  recognition.lang = "ru-RU";          // always set explicitly
  recognition.continuous = false;      // one phrase per press
  recognition.interimResults = true;   // show live text; send only the final one
  recognition.maxAlternatives = 1;
  recognition.onresult = (e) => { /* e.results[i][0].transcript, e.results[i].isFinal */ };
  recognition.onerror = (e) => { if (e.error === "not-allowed" || e.error === "service-not-allowed") setAvailable(false); };
  recognition.onend = () => setListening(false);
  recognition.start();
  ```
- Error codes to handle: `not-allowed`, `service-not-allowed` → unavailable message; `no-speech`, `aborted` → just stop listening quietly; `network`, `audio-capture`, `language-not-supported` → show a short Russian error and keep text input.
- Speech synthesis: `const u = new SpeechSynthesisUtterance(text); u.lang = "ru-RU"; speechSynthesis.cancel(); speechSynthesis.speak(u);` — cancel the previous answer before speaking a new one.
- Pick a Russian voice if available: `speechSynthesis.getVoices().find(v => v.lang.startsWith("ru"))`; voices may arrive only after the `voiceschanged` event (Chrome). If none, rely on `u.lang`.
- Wrap both APIs behind small interfaces so components and tests can inject fakes.
- In e2e, Chromium headless has no recognition: tests drive the text input; sound toggle tests stub `window.speechSynthesis.speak` with `page.addInitScript` and assert it is (not) called.

## Don't
- Don't start recognition on page load or without a user gesture.
- Don't call `speechSynthesis.speak` when the toggle is "выкл" (AC-18 checks that it is not started).
- Don't rely on `processLocally` / `SpeechRecognition.available()` — new and not in all browsers; plain recognition is the baseline.
- Don't keep a recognition instance across renders without stopping it on unmount (`recognition.abort()` in cleanup).

## Security and privacy
- Chrome sends audio to a cloud recogniser (brief, Risks); say so in the README. No audio is stored or sent to our server — only the text.

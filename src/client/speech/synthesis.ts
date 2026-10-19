/** Speak an assistant answer in Russian; silently does nothing without speech synthesis. */
export function speak(text: string): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ru-RU";
  const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith("ru"));
  if (voice) utterance.voice = voice;
  synth.cancel();
  synth.speak(utterance);
}

export function stopSpeaking(): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

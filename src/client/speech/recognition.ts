"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};
const detect = () => Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition);

/**
 * One-phrase voice input (ru-RU). `available` is false without browser support or after the
 * microphone was refused; the final transcript goes to `onFinal`.
 */
export function useSpeechRecognition(onFinal: (text: string) => void) {
  const supported = useSyncExternalStore(noopSubscribe, detect, () => true);
  const [denied, setDenied] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const onFinalRef = useRef(onFinal);
  useEffect(() => {
    onFinalRef.current = onFinal;
  });
  useEffect(() => () => recognitionRef.current?.abort(), []);

  const start = useCallback(() => {
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) return;
    setError(null);
    const recognition = new Ctor();
    recognition.lang = "ru-RU";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    let finalText = "";
    recognition.onresult = (event) => {
      let live = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (!result?.[0]) continue;
        if (result.isFinal) finalText += result[0].transcript;
        else live += result[0].transcript;
      }
      setInterim(live || finalText);
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") setDenied(true);
      else if (event.error === "network" || event.error === "audio-capture" || event.error === "language-not-supported") {
        setError("Не удалось распознать речь, введите текст");
      }
    };
    recognition.onend = () => {
      setListening(false);
      setInterim("");
      recognitionRef.current = null;
      const text = finalText.trim();
      if (text) onFinalRef.current(text);
    };
    recognitionRef.current = recognition;
    setListening(true);
    try {
      recognition.start();
    } catch {
      setListening(false);
    }
  }, []);

  const stop = useCallback(() => recognitionRef.current?.stop(), []);

  return { available: supported && !denied, listening, interim, error, start, stop };
}

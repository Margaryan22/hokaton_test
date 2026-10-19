"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { useSpeechRecognition } from "@/client/speech/recognition";
import { AlertIcon, MicIcon, MicOffIcon, Spinner, StopIcon } from "./icons";

const MAX = 500;

type Props = {
  disabled: boolean;
  disabledReason: string | null;
  busy: boolean;
  error: string | null;
  /** Resolves true when the message was accepted (the field is then cleared). */
  onSend: (text: string) => Promise<boolean>;
};

export function Composer({ disabled, disabledReason, busy, error, onSend }: Props) {
  const [text, setText] = useState("");
  const fieldRef = useRef<HTMLInputElement>(null);
  const hintId = useId();

  async function submit(value: string) {
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX || busy || disabled) return;
    if (await onSend(trimmed)) {
      setText("");
      fieldRef.current?.focus();
    }
  }

  const voice = useSpeechRecognition((spoken) => {
    setText(spoken);
    void submit(spoken);
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void submit(text);
  }

  const micUnavailable = !voice.available;
  const micDisabled = micUnavailable || disabled || (busy && !voice.listening);
  const shown = voice.listening && voice.interim ? voice.interim : text;
  const over = text.length > MAX;

  return (
    <div className="flex flex-col gap-2 border-t border-border p-3 sm:p-4">
      {micUnavailable && (
        <p role="status" className="rounded-card bg-warning-soft p-3 text-sm text-warning">
          Голосовой ввод недоступен, введите текст
        </p>
      )}
      {voice.error && !micUnavailable && (
        <p role="status" className="text-sm text-warning">
          {voice.error}
        </p>
      )}
      {disabledReason && <p className="text-sm text-muted">{disabledReason}</p>}
      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
        <div className="relative order-2 flex items-center gap-3 sm:order-1">
          <button
            type="button"
            aria-label={voice.listening ? "Остановить запись" : "Записать голос"}
            aria-pressed={voice.listening}
            disabled={micDisabled}
            onClick={voice.listening ? voice.stop : voice.start}
            className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full disabled:cursor-not-allowed ${
              micUnavailable
                ? "bg-surface-alt text-muted"
                : `text-on-primary disabled:opacity-50 ${voice.listening ? "bg-danger" : "bg-primary hover:bg-primary-hover"}`
            }`}
          >
            {voice.listening && <span aria-hidden="true" className="va-ring absolute inset-0 rounded-full bg-danger/30" />}
            <span className="relative">{micUnavailable ? <MicOffIcon /> : voice.listening ? <StopIcon /> : <MicIcon />}</span>
          </button>
          {voice.listening && (
            <span role="status" className="font-semibold text-danger">
              Слушаю…
            </span>
          )}
        </div>
        <div className="order-1 flex w-full flex-col gap-1 sm:order-2 sm:w-auto sm:min-w-0 sm:flex-1">
          <label htmlFor="chat-input" className="text-sm font-semibold">
            Сообщение
          </label>
          <input
            id="chat-input"
            ref={fieldRef}
            value={shown}
            readOnly={busy || voice.listening}
            disabled={disabled}
            autoComplete="off"
            aria-invalid={over || undefined}
            aria-describedby={over ? hintId : undefined}
            onChange={(e) => setText(e.target.value)}
            className={`min-h-11 w-full rounded-card border bg-surface px-3 text-base ${
              voice.listening ? "italic text-muted" : "text-text"
            } ${over ? "border-danger" : "border-border-strong"}`}
          />
          {text.length >= 450 && (
            <span id={hintId} className="text-sm text-danger">
              {text.length}/{MAX}
            </span>
          )}
        </div>
        <button
          type="submit"
          disabled={disabled || busy || text.trim() === "" || over}
          aria-busy={busy}
          className="order-3 inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-card bg-primary px-4 font-semibold text-on-primary hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
        >
          {busy && <Spinner />}
          Отправить
        </button>
      </form>
      {error && (
        <p role="alert" className="flex items-center gap-1 text-sm text-danger">
          <AlertIcon />
          {error}
        </p>
      )}
    </div>
  );
}

import type { Awaiting, MessageDto } from "@/shared/api";
import { btnSecondary } from "./ui";

type Props = {
  messages: MessageDto[];
  pendingText: string | null;
  awaiting: Awaiting;
  loading: boolean;
  disabled: boolean;
  onQuickReply: (text: string) => void;
};

/** Number of options in a «1. …; 2. …» question. The server wording is the source. */
function optionCount(message: MessageDto): number {
  const numbers = [...message.text.matchAll(/(?:^|[\s:;])(\d)\.\s/g)].map((m) => Number(m[1]));
  let count = 0;
  while (numbers.includes(count + 1)) count += 1;
  return Math.min(count || (message.items?.length ?? 0), 5);
}

function Caption({ who, right }: { who: string; right: boolean }) {
  return <span className={`text-xs font-semibold text-muted ${right ? "self-end" : "self-start"}`}>{who}</span>;
}

function Bubble({ message }: { message: Pick<MessageDto, "role" | "text"> }) {
  const mine = message.role === "user";
  return (
    <li className="flex flex-col gap-1">
      <Caption who={mine ? "Вы" : "Ассистент"} right={mine} />
      <p
        className={`max-w-[90%] whitespace-pre-wrap break-words rounded-card px-3 py-2 sm:max-w-[85%] ${
          mine
            ? "self-end rounded-br-sm bg-primary text-on-primary"
            : "self-start rounded-bl-sm bg-surface-alt text-text"
        }`}
      >
        {message.text}
      </p>
    </li>
  );
}

export function DialogFeed({ messages, pendingText, awaiting, loading, disabled, onQuickReply }: Props) {
  const last = messages[messages.length - 1];
  const quick: string[] =
    !pendingText && last?.role === "assistant"
      ? awaiting === "yes_no"
        ? ["Да", "Нет"]
        : awaiting === "choice"
          ? Array.from({ length: optionCount(last) }, (_, i) => String(i + 1))
          : []
      : [];

  if (loading) {
    return (
      <div aria-busy="true" className="flex flex-col gap-3">
        {[60, 40, 70].map((w, i) => (
          <div key={i} className="h-10 animate-pulse rounded-card bg-surface-alt" style={{ width: `${w}%` }} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul role="log" aria-live="polite" aria-label="Диалог" className="flex flex-col gap-3">
        {messages.length === 0 && !pendingText && (
          <li className="max-w-[90%] self-start rounded-card rounded-bl-sm bg-surface-alt px-3 py-2 text-muted">
            Скажите или напишите, например: «Напомни завтра в 10 позвонить Ивану»
          </li>
        )}
        {messages.map((m) => (
          <Bubble key={m.id} message={m} />
        ))}
        {pendingText && <Bubble message={{ role: "user", text: pendingText }} />}
      </ul>
      {pendingText && (
        <div aria-label="Ассистент отвечает" role="status" className="flex gap-1 self-start rounded-card bg-surface-alt px-4 py-3">
          {[0, 1, 2].map((i) => (
            <span key={i} className="va-dot h-2 w-2 rounded-full bg-muted" style={{ animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
      )}
      {quick.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Быстрые ответы" role="group">
          {quick.map((text) => (
            <button key={text} type="button" className={`${btnSecondary} min-w-11`} disabled={disabled} onClick={() => onQuickReply(text)}>
              {text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

import type { Token } from "./normalize";
import { isCreateVerb, kindOfWord } from "./intents";
import type { Kind } from "./types";

/** Building the title of a record from the tokens that no date/time/command rule consumed (docs/architecture.md §5). */

/** Filler words dropped at the start of a title. */
const LEADING_FILLERS = new Set(["мне", "у", "меня", "пожалуйста", "нужно", "надо", "что", "а", "и", "я", "же", "еще", "тоже", "ну", "бы"]);
const TRAILING_DROP = new Set(["в", "во", "на", "к", "до", "с", "со", "около", "пожалуйста", "и", "а", "по"]);

const MEETING_NOMINATIVE: Record<string, string> = { встречу: "встреча", планерку: "планерка", встречи: "встреча" };

function maxLength(title: string): string {
  return title.length > 200 ? title.slice(0, 200).trimEnd() : title;
}

/**
 * Title of a new record, cut from the original text so the case of names survives.
 * `kind` drops the type word of tasks/reminders («задачу»); the type word of a meeting is lower-cased and put in the nominative («встречу» -> «встреча»).
 * Returns undefined when nothing is left (meetings fall back to the kind word, handled by the caller).
 */
export function buildTitle(text: string, tokens: Token[], used: Set<number>, kind?: Kind): string | undefined {
  const kept = tokens.map((_, i) => i).filter((i) => !used.has(i));

  const drop = (i: number): boolean => {
    const t = tokens[i]!.t;
    if (LEADING_FILLERS.has(t) || isCreateVerb(t)) return true;
    const wordKind = kindOfWord(t);
    return kind !== undefined && kind !== "meeting" && wordKind === kind;
  };
  while (kept.length > 0 && drop(kept[0]!)) kept.shift();
  while (kept.length > 0 && TRAILING_DROP.has(tokens[kept[kept.length - 1]!]!.t)) kept.pop();
  if (kept.length === 0) return undefined;

  let meetingWordDone = false;
  const parts: string[] = [];
  kept.forEach((i, position) => {
    const tok = tokens[i]!;
    let word = text.slice(tok.start, tok.end);
    if (kind === "meeting" && !meetingWordDone && kindOfWord(tok.t) === "meeting") {
      word = MEETING_NOMINATIVE[tok.t] ?? word.toLowerCase();
      meetingWordDone = true;
    }
    const previous = kept[position - 1];
    if (previous !== undefined && previous === i - 1 && text.slice(tokens[previous]!.end, tok.start) === "-") {
      parts[parts.length - 1] += `-${word}`;
    } else {
      parts.push(word);
    }
  });
  return maxLength(parts.join(" "));
}

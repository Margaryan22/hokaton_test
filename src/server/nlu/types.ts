import type { Awaiting, RecordKind } from "@/shared/api";

export type Kind = RecordKind;

/** What the dialog waits for; `null` = nothing (idle). Same values as `ChatResponse.awaiting`. */
export type Expect = Awaiting;

/** Half-open interval of Moscow days `[from, to)`, `YYYY-MM-DD`; `label` completes «На <label> ничего не запланировано». */
export type Period = { from: string; to: string; label: string };

export type Tense = "past" | "future";

/** `{ ref: "focus" }` = «её/его/эту» (the last mentioned record); otherwise words to rank records by. */
export type Target = { ref: "focus" } | { kind?: Kind; terms: string[] };

export type Change = { date?: string; time?: string };

export type Intent =
  | { type: "create"; kind: Kind; title?: string; date?: string; time?: string; hasDeadline: boolean }
  | { type: "list"; period?: Period; kind?: Kind; exists: boolean }
  | { type: "search"; terms: string[]; kind?: Kind; tense?: Tense }
  | { type: "update"; target: Target; change: Change }
  | { type: "complete"; target: Target }
  | { type: "delete"; target: Target }
  | { type: "confirm"; yes: boolean }
  | { type: "choose"; index: number }
  /** Answer to a clarifying question. Only what the utterance says: no defaults. */
  | { type: "slot"; date?: string; time?: string; title?: string }
  /** Answer to «Какую запись …?» (expect = target): words to find the record by. */
  | { type: "target"; target: { ref: "focus" } | { kind?: Kind; terms: string[] } }
  | { type: "cancel" }
  | { type: "unknown" };

import type { DateTime } from "luxon";
import { defaultDate, extractPeriod, extractWhen } from "./dates";
import {
  FOCUS_PRONOUNS,
  firstKindWord,
  isComplete,
  isCreateVerb,
  isDelete,
  isExists,
  isKindFilterWord,
  isListMarker,
  isSearch,
  isStopWord,
  isUpdate,
  kindOfWord,
  matchCancel,
  matchChoose,
  matchConfirm,
  startsWithCreateVerb,
  tenseOf,
} from "./intents";
import { tokenize, type Token } from "./normalize";
import { buildTitle } from "./title";
import type { Change, Expect, Intent, Kind, Target } from "./types";

/**
 * Text -> Intent. Pure and deterministic for the same `(text, expect, now)`: no database, no state, never writes.
 * Rule order (docs/architecture.md §5): the shape of an expected answer, then delete, complete, update, search,
 * list, create, and finally the answer shapes again for an idle dialog; anything else is `unknown`.
 */
export function parse(text: string, expect: Expect, now: DateTime): Intent {
  const tokens = tokenize(text);
  if (tokens.length === 0) return { type: "unknown" };

  const answer = matchAnswer(tokens, expect);
  if (answer) return answer;

  const command = parseCommand(text, tokens, now, expect === "target");
  if (command) return command;

  if (expect === "slot") return parseSlot(text, tokens, now, true) ?? { type: "unknown" };
  if (expect === "target") return parseTargetAnswer(tokens) ?? { type: "unknown" };
  if (expect === null) return parseSlot(text, tokens, now, false) ?? { type: "unknown" };
  return { type: "unknown" };
}

// --- answers: cancel, yes/no, choice ---------------------------------------------

function matchAnswer(tokens: Token[], expect: Expect): Intent | undefined {
  if (matchCancel(tokens)) return { type: "cancel" };
  const yes = matchConfirm(tokens);
  if (yes !== undefined) {
    // «нет» to a question about a slot, a record or a choice withdraws the request; to a yes/no question it is an answer.
    if (!yes && (expect === "slot" || expect === "choice" || expect === "target")) return { type: "cancel" };
    return { type: "confirm", yes };
  }
  if (expect === "choice" || expect === null) {
    const index = matchChoose(tokens);
    if (index !== undefined) return { type: "choose", index };
  }
  return undefined;
}

// --- commands ---------------------------------------------------------------------

function parseCommand(text: string, tokens: Token[], now: DateTime, createNeedsVerb: boolean): Intent | undefined {
  if (startsWithCreateVerb(tokens)) return parseCreate(text, tokens, now, createNeedsVerb);
  if (isDelete(tokens)) return { type: "delete", target: targetOf(tokens, new Set()) };
  if (isComplete(tokens)) return { type: "complete", target: targetOf(tokens, new Set()) };
  if (isUpdate(tokens)) return parseUpdate(tokens, now);
  if (isSearch(tokens)) return parseSearch(tokens);
  if (isListMarker(tokens)) return parseList(tokens, now);
  return parseCreate(text, tokens, now, createNeedsVerb);
}

function withKind<T extends object>(base: T, kind: Kind | undefined): T & { kind?: Kind } {
  return kind ? { ...base, kind } : base;
}

function parseCreate(text: string, tokens: Token[], now: DateTime, needsVerb = false): Intent | undefined {
  const hasVerb = tokens.some((x) => isCreateVerb(x.t));
  if (needsVerb && !hasVerb) return undefined;
  const kindWord = firstKindWord(tokens);
  if (!hasVerb && !kindWord) return undefined;

  const used = new Set<number>();
  const when = extractWhen(tokens, used, now);
  // «В четверг в 11 у меня встреча …»: no verb, so a type word needs to start the phrase or come with a date or time.
  if (!hasVerb && kindWord && kindWord.index !== 0 && when.date === undefined && when.time === undefined) return undefined;

  const kind: Kind = kindWord?.kind ?? "task";
  const resolved = defaultDate(when, now);
  const title = buildTitle(text, tokens, used, kind) ?? (kind === "meeting" ? "встреча" : undefined);

  const intent: Extract<Intent, { type: "create" }> = { type: "create", kind, hasDeadline: resolved.deadline && resolved.date !== undefined };
  if (title !== undefined) intent.title = title;
  if (resolved.date !== undefined) intent.date = resolved.date;
  if (resolved.time !== undefined) intent.time = resolved.time;
  return intent;
}

function parseList(tokens: Token[], now: DateTime): Intent {
  const used = new Set<number>();
  const period = extractPeriod(tokens, used, now);
  const kind = firstKindWord(tokens)?.kind;
  const intent: Extract<Intent, { type: "list" }> = { type: "list", exists: isExists(tokens) };
  if (period) intent.period = period;
  if (kind) intent.kind = kind;
  return intent;
}

function parseSearch(tokens: Token[]): Intent {
  const kind = firstKindWord(tokens)?.kind;
  const tense = tokens.map((x) => tenseOf(x.t)).find((x) => x !== undefined);
  const terms = tokens.filter((x) => !isStopWord(x.t) && !isKindFilterWord(x.t) && tenseOf(x.t) === undefined).map((x) => x.t);
  const intent: Extract<Intent, { type: "search" }> = { type: "search", terms };
  if (kind) intent.kind = kind;
  if (tense) intent.tense = tense;
  return intent;
}

function parseUpdate(tokens: Token[], now: DateTime): Intent {
  const used = new Set<number>();
  const when = extractWhen(tokens, used, now);
  const change: Change = {};
  if (when.date !== undefined) change.date = when.date;
  if (when.time !== undefined) change.time = when.time;
  return { type: "update", target: targetOf(tokens, used), change };
}

/** The record a command is about: «её/эту» -> the focus; otherwise the type and the words left over. */
function targetOf(tokens: Token[], used: Set<number>): Target {
  const rest = tokens.filter((_, i) => !used.has(i));
  const terms = rest.filter((x) => !isStopWord(x.t) && !isKindFilterWord(x.t) && tenseOf(x.t) === undefined).map((x) => x.t);
  const kind = rest.map((x) => kindOfWord(x.t)).find((x) => x !== undefined);
  if (terms.length === 0 && rest.some((x) => FOCUS_PRONOUNS.has(x.t))) return { ref: "focus" };
  return withKind({ terms }, kind);
}

// --- answers to a clarifying question ------------------------------------------------

/**
 * A date, a time or free words answering «На какое время…?» / «Что нужно сделать?».
 * Waiting for a slot, any leftover words are the title; idle, only a bare date or time is understood.
 */
function parseSlot(text: string, tokens: Token[], now: DateTime, waiting: boolean): Intent | undefined {
  const used = new Set<number>();
  const when = extractWhen(tokens, used, now, { bareHour: waiting });
  const title = buildTitle(text, tokens, used);
  if (!waiting && title !== undefined) return undefined;

  const intent: Extract<Intent, { type: "slot" }> = { type: "slot" };
  if (when.date !== undefined) intent.date = when.date;
  if (when.time !== undefined) intent.time = when.time;
  if (title !== undefined) intent.title = title;
  return intent.date === undefined && intent.time === undefined && intent.title === undefined ? undefined : intent;
}

function parseTargetAnswer(tokens: Token[]): Intent | undefined {
  const target = targetOf(tokens, new Set());
  if ("ref" in target) return { type: "target", target };
  if (target.terms.length === 0 && target.kind === undefined) return undefined;
  return { type: "target", target };
}

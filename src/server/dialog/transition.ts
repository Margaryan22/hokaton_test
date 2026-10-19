import type { DateTime } from "luxon";
import type { RecordRow } from "@/db/schema";
import type { Panel, RecordDto } from "@/shared/api";
import type { Change, Intent, Target } from "../nlu/types";
import { resolveTargets, searchRecords } from "../search";
import { MEETING_MINUTES, meetingStart, PANEL_LIMIT, toRecordDto } from "../services/records";
import * as r from "./replies";
import { IDLE, type DialogState, type Draft, type Missing, type Op, type Write } from "./state";

// ADR-003: transition(state, intent, ctx) is a pure function. It reads the user's records from ctx,
// never writes: the writes are returned as effects and applied by the engine in one transaction.

export type Ctx = {
  now: DateTime;
  /** Moscow day `YYYY-MM-DD`. */
  today: string;
  /** All records of the current user, in list order (ADR-004). */
  records: RecordRow[];
  focusId: number | null;
};

export type Effect =
  | { type: "create"; draft: Draft & { title: string } }
  | { type: "update"; id: number; date: string | null; time: string | null }
  | { type: "done"; id: number }
  | { type: "delete"; id: number };

export type FocusChange = { type: "keep" } | { type: "set"; id: number } | { type: "created" } | { type: "clear" };

export type Outcome = {
  state: DialogState;
  effects: Effect[];
  reply: string;
  focus: FocusChange;
  /** For list and search replies: the right-hand column equals the reply. */
  panel?: Panel;
  /** Records the reply shows (snapshot in the message). */
  shown?: RecordDto[];
};

const keep: FocusChange = { type: "keep" };

function say(reply: string, state: DialogState = IDLE, extra: Partial<Outcome> = {}): Outcome {
  return { state, effects: [], reply, focus: keep, ...extra };
}

export function transition(state: DialogState, intent: Intent, ctx: Ctx): Outcome {
  if (intent.type === "cancel") {
    return say(state.kind === "idle" ? "Хорошо." : r.CANCELLED);
  }
  switch (state.kind) {
    case "idle":
      return command(intent, ctx) ?? say(intent.type === "unknown" ? r.NOT_UNDERSTOOD : r.NOTHING_TO_CONFIRM);

    case "await_slot": {
      if (intent.type === "slot") return continueDraft(mergeSlot(state.draft, intent), ctx);
      return command(intent, ctx) ?? askAgain(state.draft);
    }

    case "await_conflict": {
      if (intent.type === "confirm") {
        return intent.yes
          ? applyWrite(state.write, ctx)
          : say(state.write.type === "create" ? "Хорошо, не ставлю." : "Хорошо, не переношу.");
      }
      return command(intent, ctx) ?? repeatConflict(state, ctx);
    }

    case "await_delete": {
      const rec = find(ctx, state.recordId);
      if (!rec) return say("Запись не найдена");
      if (intent.type === "confirm") {
        return intent.yes
          ? { state: IDLE, effects: [{ type: "delete", id: rec.id }], reply: r.deleted(rec.kind, rec.title), focus: { type: "clear" } }
          : say("Хорошо, не удаляю.");
      }
      return command(intent, ctx) ?? say(r.askDelete(rec.kind, rec.title), state);
    }

    case "await_choice": {
      const candidates = state.candidateIds.map((id) => find(ctx, id)).filter((x): x is RecordRow => x !== undefined);
      if (intent.type === "choose") {
        const picked = candidates[intent.index - 1];
        if (!picked) {
          return say(`${r.choiceOutOfRange(candidates.length)} ${r.askChoice(state.op, candidates.map(toRecordDto), ctx.today)}`, state);
        }
        return applyOp(state.op, picked, state.change ?? {}, ctx);
      }
      return command(intent, ctx) ?? say(r.askChoice(state.op, candidates.map(toRecordDto), ctx.today), state);
    }

    case "await_target": {
      if (intent.type === "target") return runOp(state.op, intent.target, state.change ?? {}, ctx);
      return command(intent, ctx) ?? say(r.askTarget(state.op), state);
    }
  }
}

/** A full command that works from any state; undefined for answers (confirm, choose, slot, target) and unknown. */
function command(intent: Intent, ctx: Ctx): Outcome | undefined {
  switch (intent.type) {
    case "create":
      return continueDraft(
        { kind: intent.kind, title: intent.title, date: intent.date, time: intent.time, hasDeadline: intent.hasDeadline },
        ctx,
      );
    case "list":
      return list(intent, ctx);
    case "search":
      return search(intent, ctx);
    case "update":
      // «Перенеси встречу с дизайнером» without a new day or time: ask for it first.
      if (intent.change.date === undefined && intent.change.time === undefined) return say(r.askMoveWhen);
      return runOp("update", intent.target, intent.change, ctx);
    case "complete":
      return runOp("complete", intent.target, {}, ctx);
    case "delete":
      return runOp("delete", intent.target, {}, ctx);
    default:
      return undefined;
  }
}

// --- creating ----------------------------------------------------------------------------

function mergeSlot(draft: Draft, slot: { date?: string; time?: string; title?: string }): Draft {
  return {
    ...draft,
    title: draft.title ?? slot.title,
    date: slot.date ?? draft.date,
    time: slot.time ?? draft.time,
  };
}

function missingOf(draft: Draft): Missing[] {
  const missing: Missing[] = [];
  if (!draft.title?.trim()) missing.push("title");
  if (draft.kind !== "task") {
    if (!draft.date) missing.push("date");
    if (!draft.time) missing.push("time");
  }
  return missing;
}

function askAgain(draft: Draft): Outcome {
  const missing = missingOf(draft);
  const question = r.askSlot(draft.kind, {
    title: missing.includes("title"),
    date: missing.includes("date"),
    time: missing.includes("time"),
  });
  return say(question, { kind: "await_slot", draft, missing });
}

function continueDraft(draft: Draft, ctx: Ctx): Outcome {
  if (missingOf(draft).length > 0) return askAgain(draft);
  const complete = { ...draft, title: draft.title!.trim() };
  if (complete.kind === "task" && complete.time && !complete.date) complete.date = ctx.today;
  if (complete.kind === "meeting") {
    const conflicts = conflictsAt(ctx, meetingStart(complete.date!, complete.time!), undefined);
    if (conflicts.length > 0) {
      return say(r.conflictQuestion(conflicts[0]!, ctx.today, false), {
        kind: "await_conflict",
        write: { type: "create", draft: complete },
        conflictIds: conflicts.map((c) => c.id),
      });
    }
  }
  return createOutcome(complete, ctx);
}

function createOutcome(draft: Draft & { title: string }, ctx: Ctx): Outcome {
  let reply: string;
  if (draft.kind === "reminder") reply = r.reminderCreated(draft.date!, draft.time!, draft.title, ctx.today);
  else if (draft.kind === "meeting") reply = r.meetingCreated(draft.title, draft.date!, draft.time!, ctx.today);
  else reply = r.taskCreated(draft.title, draft.date, draft.time, draft.hasDeadline, ctx.today);
  return { state: IDLE, effects: [{ type: "create", draft }], reply, focus: { type: "created" } };
}

function conflictsAt(ctx: Ctx, startsAt: Date, excludeId: number | undefined): RecordDto[] {
  const span = MEETING_MINUTES * 60_000;
  return ctx.records
    .filter((x) => x.kind === "meeting" && x.startsAt !== null && x.id !== excludeId && Math.abs(x.startsAt.getTime() - startsAt.getTime()) < span)
    .map(toRecordDto);
}

function applyWrite(write: Write, ctx: Ctx): Outcome {
  if (write.type === "create") return createOutcome({ ...write.draft, title: write.draft.title! }, ctx);
  const rec = find(ctx, write.recordId);
  if (!rec) return say("Запись не найдена");
  return {
    state: IDLE,
    effects: [{ type: "update", id: rec.id, date: write.date, time: write.time }],
    reply: r.moved(rec.kind, rec.title, write.date ?? ctx.today, write.time, ctx.today),
    focus: { type: "set", id: rec.id },
  };
}

function repeatConflict(state: Extract<DialogState, { kind: "await_conflict" }>, ctx: Ctx): Outcome {
  const first = find(ctx, state.conflictIds[0] ?? -1);
  return first
    ? say(r.conflictQuestion(toRecordDto(first), ctx.today, state.write.type === "update"), state)
    : say("Всё равно поставить?", state);
}

// --- lists --------------------------------------------------------------------------------

function list(intent: Extract<Intent, { type: "list" }>, ctx: Ctx): Outcome {
  const { period, kind } = intent;
  let rows: RecordRow[];
  let title: string;
  let when: string;
  let style: r.LineStyle;
  if (period) {
    rows = ctx.records.filter((x) => x.dueDate !== null && x.dueDate >= period.from && x.dueDate < period.to && (!kind || x.kind === kind));
    title = `На ${period.label}`;
    when = `на ${period.label}`;
    style = daysBetween(period.from, period.to) > 1 ? "datetime" : "time";
  } else {
    rows = ctx.records.filter((x) => (x.dueDate === null || x.dueDate >= ctx.today) && (!kind || x.kind === kind));
    title = "Ближайшие";
    when = "в ближайшее время";
    style = "datetime";
  }
  const items = rows.slice(0, PANEL_LIMIT).map(toRecordDto);
  const panel: Panel = { title, items, total: rows.length };
  const focus: FocusChange = rows.length === 1 ? { type: "set", id: rows[0]!.id } : keep;
  const shown = items.slice(0, r.LIST_LIMIT);

  let reply: string;
  if (intent.exists) reply = r.existsReply(kind, when, items, rows.length, style, ctx.today);
  else if (rows.length === 0) reply = period ? r.emptyPeriod(period.label) : r.emptyUpcoming;
  else reply = r.listReply(title, items, rows.length, style, ctx.today);
  return say(reply, IDLE, { panel, shown, focus });
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

function search(intent: Extract<Intent, { type: "search" }>, ctx: Ctx): Outcome {
  if (intent.terms.length === 0 && !intent.kind && !intent.tense) return say(r.SEARCH_NEEDS_WORDS);
  const { items: rows, total } = searchRecords(ctx.records, { terms: intent.terms, kind: intent.kind, tense: intent.tense }, ctx.now);
  const title = intent.terms.length > 0 ? `Поиск: ${intent.terms.join(" ")}` : "Поиск";
  const items = rows.map(toRecordDto);
  const panel: Panel = { title, items, total };
  if (total === 0) return say(r.SEARCH_EMPTY, IDLE, { panel, shown: [] });
  const focus: FocusChange = total === 1 ? { type: "set", id: rows[0]!.id } : keep;
  return say(r.searchReply(intent.kind, items, total), IDLE, { panel, shown: items, focus });
}

// --- delete / complete / update -----------------------------------------------------------------

function find(ctx: Ctx, id: number): RecordRow | undefined {
  return ctx.records.find((x) => x.id === id);
}

function runOp(op: Op, target: Target, change: Change, ctx: Ctx): Outcome {
  const awaitTarget = (): Outcome =>
    say(r.askTarget(op), { kind: "await_target", op, ...(Object.keys(change).length > 0 ? { change } : {}) });

  if ("ref" in target) {
    const focus = ctx.focusId === null ? undefined : find(ctx, ctx.focusId);
    return focus ? applyOp(op, focus, change, ctx) : awaitTarget();
  }
  if (target.terms.length === 0) return awaitTarget();

  const pool = op === "complete" ? ctx.records.filter((x) => !x.done) : ctx.records;
  const candidates = resolveTargets(pool, { kind: target.kind, terms: target.terms });
  if (candidates.length === 0) return say(r.NOT_FOUND_ANY);
  if (candidates.length === 1) return applyOp(op, candidates[0]!, change, ctx);
  return say(r.askChoice(op, candidates.map(toRecordDto), ctx.today), {
    kind: "await_choice",
    op,
    candidateIds: candidates.map((c) => c.id),
    ...(Object.keys(change).length > 0 ? { change } : {}),
  });
}

function applyOp(op: Op, rec: RecordRow, change: Change, ctx: Ctx): Outcome {
  const focus: FocusChange = { type: "set", id: rec.id };
  if (op === "delete") {
    return say(r.askDelete(rec.kind, rec.title), { kind: "await_delete", recordId: rec.id }, { focus });
  }
  if (op === "complete") {
    if (rec.done) return say(r.alreadyDone(rec.title), IDLE, { focus });
    return { state: IDLE, effects: [{ type: "done", id: rec.id }], reply: r.completed(rec.kind, rec.title), focus };
  }
  return planUpdate(rec, change, ctx);
}

/** A new day keeps the old time and a new time keeps the old day (AC-16). */
function planUpdate(rec: RecordRow, change: Change, ctx: Ctx): Outcome {
  const current = toRecordDto(rec);
  if (change.date === undefined && change.time === undefined) return say(r.askMoveWhen);
  const time = change.time ?? current.time;
  const date = change.date ?? current.date ?? (time ? ctx.today : null);
  const focus: FocusChange = { type: "set", id: rec.id };

  if (rec.kind === "meeting" && date && time) {
    const conflicts = conflictsAt(ctx, meetingStart(date, time), rec.id);
    if (conflicts.length > 0) {
      return say(r.conflictQuestion(conflicts[0]!, ctx.today, true), {
        kind: "await_conflict",
        write: { type: "update", recordId: rec.id, date, time },
        conflictIds: conflicts.map((c) => c.id),
      }, { focus });
    }
  }
  return {
    state: IDLE,
    effects: [{ type: "update", id: rec.id, date, time }],
    reply: r.moved(rec.kind, rec.title, date ?? ctx.today, time, ctx.today),
    focus,
  };
}

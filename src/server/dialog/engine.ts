import type { DateTime } from "luxon";
import type { Db } from "@/db/client";
import { addDialogMessage, getDialogState, listLastMessages, resetDialog as eraseDialog, setDialogState } from "@/db/dialog";
import { listAllRecords } from "@/db/records";
import type { DialogMessageRow } from "@/db/schema";
import type { Awaiting, ChatResponse, DialogResponse, MessageDto, Panel, RecordDto } from "@/shared/api";
import { parse } from "../nlu/parse";
import { ServiceError } from "../services/errors";
import { createRecord, deleteRecord, setDone, updateRecord, upcomingPanel } from "../services/records";
import { expectOf, IDLE, parseState, type DialogState } from "./state";
import { transition, type Ctx, type Effect, type Outcome } from "./transition";

export const HISTORY_LIMIT = 50;

/** Runs `work` in one transaction; `tx` has the same query API as the database. */
function inTransaction<T>(db: Db, work: (tx: Db) => Promise<T>): Promise<T> {
  return db.transaction((tx) => work(tx as unknown as Db));
}

function awaitingOf(state: DialogState): Awaiting {
  switch (expectOf(state)) {
    case "slot":
      return "slot";
    case "yes_no":
      return "yes_no";
    case "choice":
      return "choice";
    case "target":
      return "target";
    default:
      return null;
  }
}

function toMessageDto(row: DialogMessageRow): MessageDto {
  let items: RecordDto[] | null = null;
  if (row.itemsJson) {
    try {
      items = JSON.parse(row.itemsJson) as RecordDto[];
    } catch {
      items = null;
    }
  }
  return { id: row.id, role: row.role, text: row.text, items, createdAt: row.createdAt.toISOString() };
}

/** Applies one effect; returns the id of a created record. Every call filters by userId. */
async function applyEffect(db: Db, userId: number, effect: Effect, now: DateTime): Promise<number | undefined> {
  switch (effect.type) {
    case "create": {
      const { kind, title, date, time } = effect.draft;
      return (await createRecord(db, userId, { kind, title, date: date ?? null, time: time ?? null }, now)).id;
    }
    case "update":
      await updateRecord(db, userId, effect.id, { date: effect.date, time: effect.time }, now);
      return undefined;
    case "done":
      await setDone(db, userId, effect.id, true, now);
      return undefined;
    case "delete":
      await deleteRecord(db, userId, effect.id);
      return undefined;
  }
}

/** One turn: the user's text in, the assistant's reply out. All reads and writes of the turn are one transaction. */
export async function handleChat(db: Db, userId: number, text: string, now: DateTime): Promise<ChatResponse> {
  return inTransaction(db, async (tx) => {
    const stateRow = await getDialogState(tx, userId);
    const state = parseState(stateRow?.stateJson);
    const records = await listAllRecords(tx, userId);
    const focusId = stateRow?.focusRecordId ?? null;
    const ctx: Ctx = { now, today: now.toISODate()!, records, focusId };

    const userRow = await addDialogMessage(tx, userId, { role: "user", text }, now.toJSDate());

    let outcome: Outcome;
    let createdId: number | undefined;
    try {
      outcome = transition(state, parse(text, expectOf(state), now), ctx);
      for (const effect of outcome.effects) createdId = (await applyEffect(tx, userId, effect, now)) ?? createdId;
    } catch (error) {
      if (!(error instanceof ServiceError)) throw error;
      // A business error is an answer, not a failure: the user sees the message and the dialog starts over.
      outcome = { state: IDLE, effects: [], reply: error.message, focus: { type: "keep" } };
    }

    let focusRecordId = focusId;
    if (outcome.focus.type === "set") focusRecordId = outcome.focus.id;
    else if (outcome.focus.type === "created") focusRecordId = createdId ?? focusId;
    else if (outcome.focus.type === "clear") focusRecordId = null;
    await setDialogState(tx, userId, { stateJson: JSON.stringify(outcome.state), focusRecordId }, now.toJSDate());

    const shown = outcome.shown ?? null;
    const assistantRow = await addDialogMessage(
      tx,
      userId,
      { role: "assistant", text: outcome.reply, itemsJson: shown ? JSON.stringify(shown) : null },
      now.toJSDate(),
    );
    const panel: Panel = outcome.panel ?? (await upcomingPanel(tx, userId, now));
    return { messages: [toMessageDto(userRow), toMessageDto(assistantRow)], panel, awaiting: awaitingOf(outcome.state) };
  });
}

/** Page load: the last messages, what the assistant waits for, the default panel. */
export async function loadDialog(db: Db, userId: number, now: DateTime): Promise<DialogResponse> {
  const rows = await listLastMessages(db, userId, HISTORY_LIMIT);
  const state = parseState((await getDialogState(db, userId))?.stateJson);
  return { messages: rows.map(toMessageDto), awaiting: awaitingOf(state), panel: await upcomingPanel(db, userId, now) };
}

/** «Новый диалог»: messages, state and focus are erased; records stay. */
export function resetDialog(db: Db, userId: number): Promise<void> {
  return eraseDialog(db, userId);
}

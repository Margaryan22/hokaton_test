import { and, desc, eq, lte } from "drizzle-orm";
import type { Db } from "./client";
import { MAX_DIALOG_MESSAGES_PER_USER } from "./limits";
import {
  dialogMessages,
  dialogStates,
  records,
  type DialogMessageRow,
  type DialogStateRow,
} from "./schema";

export type MessageInput = { role: "user" | "assistant"; text: string; itemsJson?: string | null };

export const IDLE_STATE_JSON = '{"kind":"idle"}';

/** Appends a message and keeps only the last MAX_DIALOG_MESSAGES_PER_USER of the user's messages. */
export async function addDialogMessage(db: Db, userId: number, input: MessageInput, now: Date): Promise<DialogMessageRow> {
  const [row] = await db
    .insert(dialogMessages)
    .values({ userId, role: input.role, text: input.text, itemsJson: input.itemsJson ?? null, createdAt: now })
    .returning();
  const [oldest] = await db
    .select({ id: dialogMessages.id })
    .from(dialogMessages)
    .where(eq(dialogMessages.userId, userId))
    .orderBy(desc(dialogMessages.id))
    .limit(1)
    .offset(MAX_DIALOG_MESSAGES_PER_USER);
  if (oldest) {
    await db.delete(dialogMessages).where(and(eq(dialogMessages.userId, userId), lte(dialogMessages.id, oldest.id)));
  }
  return row!;
}

/** The last `limit` messages, oldest first. */
export async function listLastMessages(db: Db, userId: number, limit: number): Promise<DialogMessageRow[]> {
  const rows = await db
    .select()
    .from(dialogMessages)
    .where(eq(dialogMessages.userId, userId))
    .orderBy(desc(dialogMessages.id))
    .limit(limit);
  return rows.reverse();
}

export async function getDialogState(db: Db, userId: number): Promise<DialogStateRow | null> {
  const [row] = await db.select().from(dialogStates).where(eq(dialogStates.userId, userId)).limit(1);
  return row ?? null;
}

/** Upsert. A focus record that is not the user's own is stored as null. */
export async function setDialogState(
  db: Db,
  userId: number,
  state: { stateJson: string; focusRecordId: number | null },
  now: Date,
): Promise<void> {
  let focusRecordId = state.focusRecordId;
  if (focusRecordId !== null) {
    const [own] = await db
      .select({ id: records.id })
      .from(records)
      .where(and(eq(records.userId, userId), eq(records.id, focusRecordId)))
      .limit(1);
    if (!own) focusRecordId = null;
  }
  const values = { stateJson: state.stateJson, focusRecordId, updatedAt: now };
  await db
    .insert(dialogStates)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: dialogStates.userId, set: values });
}

/** "Новый диалог": erases messages, state and focus. Records stay. */
export async function resetDialog(db: Db, userId: number): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(dialogMessages).where(eq(dialogMessages.userId, userId));
    await tx.delete(dialogStates).where(eq(dialogStates.userId, userId));
  });
}


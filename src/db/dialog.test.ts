import { beforeEach, describe, expect, test } from "vitest";
import {
  addDialogMessage,
  getDialogState,
  IDLE_STATE_JSON,
  listLastMessages,
  resetDialog,
  setDialogState,
} from "./dialog";
import { MAX_DIALOG_MESSAGES_PER_USER } from "./limits";
import { createRecord } from "./records";
import { dialogMessages } from "./schema";
import { setupTestDb } from "./test-db";
import { getOrCreateUser } from "./users";

const now = new Date("2026-10-19T07:00:00Z");
let db: Awaited<ReturnType<typeof setupTestDb>>;
let anna: number;
let boris: number;

beforeEach(async () => {
  db = await setupTestDb();
  anna = (await getOrCreateUser(db, "Анна", now)).id;
  boris = (await getOrCreateUser(db, "Борис", now)).id;
});

describe("messages", () => {
  test("the last N come back oldest first and only for their owner", async () => {
    for (const text of ["1", "2", "3"]) await addDialogMessage(db, anna, { role: "user", text }, now);
    await addDialogMessage(db, boris, { role: "user", text: "чужое" }, now);
    expect((await listLastMessages(db, anna, 2)).map((m) => m.text)).toEqual(["2", "3"]);
    expect((await listLastMessages(db, boris, 50)).map((m) => m.text)).toEqual(["чужое"]);
  });

  test("only the last MAX messages per user are kept; other users are untouched", async () => {
    await addDialogMessage(db, boris, { role: "user", text: "старое Бориса" }, now);
    for (let i = 0; i < MAX_DIALOG_MESSAGES_PER_USER + 5; i++) {
      await addDialogMessage(db, anna, { role: "user", text: `m${i}` }, now);
    }
    const kept = await listLastMessages(db, anna, 1000);
    expect(kept).toHaveLength(MAX_DIALOG_MESSAGES_PER_USER);
    expect(kept.at(-1)!.text).toBe(`m${MAX_DIALOG_MESSAGES_PER_USER + 4}`);
    expect(kept[0]!.text).toBe("m5");
    expect(await listLastMessages(db, boris, 10)).toHaveLength(1);
  });

  test("a user message over 500 characters is rejected by the database", async () => {
    await expect(addDialogMessage(db, anna, { role: "user", text: "я".repeat(501) }, now)).rejects.toThrow();
    await addDialogMessage(db, anna, { role: "assistant", text: "я".repeat(501) }, now);
  });

  test("items_json is stored as given", async () => {
    await addDialogMessage(db, anna, { role: "assistant", text: "ок", itemsJson: "[]" }, now);
    expect((await listLastMessages(db, anna, 1))[0]!.itemsJson).toBe("[]");
  });
});

describe("state", () => {
  test("no row until set; set is an upsert", async () => {
    expect(await getDialogState(db, anna)).toBeNull();
    await setDialogState(db, anna, { stateJson: '{"kind":"await_delete","recordId":1}', focusRecordId: null }, now);
    await setDialogState(db, anna, { stateJson: IDLE_STATE_JSON, focusRecordId: null }, now);
    expect(await getDialogState(db, anna)).toMatchObject({ stateJson: IDLE_STATE_JSON });
    expect(await getDialogState(db, boris)).toBeNull();
  });

  test("a focus record of another user is not stored", async () => {
    const theirs = await createRecord(db, boris, { kind: "task", title: "чужая" }, now);
    const mine = await createRecord(db, anna, { kind: "task", title: "моя" }, now);
    await setDialogState(db, anna, { stateJson: IDLE_STATE_JSON, focusRecordId: theirs.id }, now);
    expect((await getDialogState(db, anna))!.focusRecordId).toBeNull();
    await setDialogState(db, anna, { stateJson: IDLE_STATE_JSON, focusRecordId: mine.id }, now);
    expect((await getDialogState(db, anna))!.focusRecordId).toBe(mine.id);
  });

  test("resetDialog erases only that user's messages and state", async () => {
    await addDialogMessage(db, anna, { role: "user", text: "a" }, now);
    await addDialogMessage(db, boris, { role: "user", text: "b" }, now);
    await setDialogState(db, anna, { stateJson: IDLE_STATE_JSON, focusRecordId: null }, now);
    await resetDialog(db, anna);
    expect(await listLastMessages(db, anna, 10)).toEqual([]);
    expect(await getDialogState(db, anna)).toBeNull();
    expect(await db.select().from(dialogMessages)).toHaveLength(1);
  });

  test("deleting a record clears the focus instead of failing", async () => {
    const r = await createRecord(db, anna, { kind: "task", title: "t" }, now);
    await setDialogState(db, anna, { stateJson: IDLE_STATE_JSON, focusRecordId: r.id }, now);
    const { deleteRecord } = await import("./records");
    await deleteRecord(db, anna, r.id);
    expect((await getDialogState(db, anna))!.focusRecordId).toBeNull();
  });
});

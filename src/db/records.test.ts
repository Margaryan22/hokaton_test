import { beforeEach, describe, expect, test } from "vitest";
import { MAX_RECORDS_PER_USER } from "./limits";
import {
  countRecords,
  createRecord,
  deleteRecord,
  getRecord,
  listAllRecords,
  listRecordsByDueRange,
  listUpcomingRecords,
  updateRecord,
} from "./records";
import { records } from "./schema";
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

describe("user scoping (AC-20)", () => {
  test("Boris never sees, changes or deletes Anna's record", async () => {
    const mine = await createRecord(db, anna, { kind: "task", title: "Секрет Анны", dueDate: "2026-10-20" }, now);
    expect(await getRecord(db, boris, mine.id)).toBeNull();
    expect(await listAllRecords(db, boris)).toEqual([]);
    expect(await listRecordsByDueRange(db, boris, "2026-10-01", "2026-11-01")).toEqual([]);
    expect(await listUpcomingRecords(db, boris, "2026-10-19", 50)).toEqual([]);
    expect(await countRecords(db, boris)).toBe(0);
    expect(await updateRecord(db, boris, mine.id, { done: true }, now)).toBeNull();
    expect(await deleteRecord(db, boris, mine.id)).toBe(false);
    expect(await getRecord(db, anna, mine.id)).toMatchObject({ done: false, title: "Секрет Анны" });
  });
});

describe("queries", () => {
  test("range is half-open and ordered: untimed first, then by time, undated excluded", async () => {
    const t = (iso: string) => new Date(iso);
    await createRecord(db, anna, { kind: "meeting", title: "B", dueDate: "2026-10-20", startsAt: t("2026-10-20T11:00:00Z") }, now);
    await createRecord(db, anna, { kind: "meeting", title: "A", dueDate: "2026-10-20", startsAt: t("2026-10-20T07:00:00Z") }, now);
    await createRecord(db, anna, { kind: "task", title: "Весь день", dueDate: "2026-10-20" }, now);
    await createRecord(db, anna, { kind: "task", title: "Завтра", dueDate: "2026-10-21" }, now);
    await createRecord(db, anna, { kind: "task", title: "Без даты" }, now);
    const day = await listRecordsByDueRange(db, anna, "2026-10-20", "2026-10-21");
    expect(day.map((r) => r.title)).toEqual(["Весь день", "A", "B"]);
    const meetings = await listRecordsByDueRange(db, anna, "2026-10-20", "2026-10-22", "meeting");
    expect(meetings.map((r) => r.title)).toEqual(["A", "B"]);
    const upcoming = await listUpcomingRecords(db, anna, "2026-10-21", 50);
    expect(upcoming.map((r) => r.title)).toEqual(["Завтра", "Без даты"]);
  });

  test("update and delete work for the owner; countRecords counts", async () => {
    const r = await createRecord(db, anna, { kind: "task", title: "Купить молоко" }, now);
    expect(await countRecords(db, anna)).toBe(1);
    const later = new Date("2026-10-19T08:00:00Z");
    expect(await updateRecord(db, anna, r.id, { done: true }, later)).toMatchObject({ done: true, updatedAt: later });
    expect(await deleteRecord(db, anna, r.id)).toBe(true);
    expect(await countRecords(db, anna)).toBe(0);
  });

  test("the per-user record limit is exposed", () => {
    expect(MAX_RECORDS_PER_USER).toBeGreaterThan(1000);
  });
});

describe("constraints in the database", () => {
  const insert = (values: Partial<typeof records.$inferInsert>) =>
    db.insert(records).values({ userId: anna, kind: "task", title: "x", ...values });

  test("starts_at without due_date is rejected", async () => {
    await expect(insert({ startsAt: now })).rejects.toThrow();
  });
  test("empty and too long titles are rejected", async () => {
    await expect(insert({ title: "" })).rejects.toThrow();
    await expect(insert({ title: "я".repeat(201) })).rejects.toThrow();
  });
  test("a malformed due_date is rejected", async () => {
    await expect(insert({ dueDate: "20.10.2026" })).rejects.toThrow();
  });
  test("an unknown kind is rejected", async () => {
    await expect(insert({ kind: "event" as never })).rejects.toThrow();
  });
  test("a record needs an existing user", async () => {
    await expect(insert({ userId: 9999 })).rejects.toThrow();
  });
  test("(user_id, source_id) is unique, null source_id is not", async () => {
    await insert({ sourceId: 1 });
    await expect(insert({ sourceId: 1 })).rejects.toThrow();
    await insert({});
    await insert({});
  });
});

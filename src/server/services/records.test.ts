import { DateTime } from "luxon";
import { beforeEach, describe, expect, test } from "vitest";
import { createRecord as insertRaw } from "@/db/records";
import { MAX_RECORDS_PER_USER } from "@/db/limits";
import { setupTestDb } from "@/db/test-db";
import { getOrCreateUser } from "@/db/users";
import { ServiceError } from "./errors";
import {
  createRecord,
  deleteRecord,
  findMeetingConflicts,
  listByPeriod,
  meetingStart,
  setDone,
  updateRecord,
  upcomingPanel,
} from "./records";

const now = DateTime.fromISO("2026-10-19T10:00:00", { zone: "Europe/Moscow" });
let db: Awaited<ReturnType<typeof setupTestDb>>;
let anna: number;
let boris: number;

beforeEach(async () => {
  db = await setupTestDb();
  anna = (await getOrCreateUser(db, "Анна", now.toJSDate())).id;
  boris = (await getOrCreateUser(db, "Борис", now.toJSDate())).id;
});

async function code(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (e) {
    if (e instanceof ServiceError) return e.code;
    throw e;
  }
  return null;
}

describe("createRecord validation", () => {
  test("stores a meeting and returns Moscow date and time", async () => {
    const dto = await createRecord(db, anna, { kind: "meeting", title: " Планёрка ", date: "2026-10-20", time: "15:00" }, now);
    expect(dto).toMatchObject({ kind: "meeting", title: "Планёрка", date: "2026-10-20", time: "15:00", done: false });
  });

  test("a task may have no date", async () => {
    const dto = await createRecord(db, anna, { kind: "task", title: "Купить сыр" }, now);
    expect(dto).toMatchObject({ date: null, time: null });
  });

  test.each([
    ["impossible day", { date: "2026-02-30" }],
    ["huge year from «через N дней»", { date: "99999-01-01" }],
    ["year far in the future", { date: "2500-01-01" }],
    ["not a date", { date: "завтра" }],
    ["bad time", { date: "2026-10-20", time: "25:00" }],
    ["time without date", { time: "10:00" }],
  ])("rejects %s", async (_name, slots) => {
    expect(await code(createRecord(db, anna, { kind: "task", title: "x", ...slots }, now))).toBe("invalid_input");
  });

  test("meetings and reminders need date and time", async () => {
    expect(await code(createRecord(db, anna, { kind: "meeting", title: "x", date: "2026-10-20" }, now))).toBe("invalid_input");
    expect(await code(createRecord(db, anna, { kind: "reminder", title: "x" }, now))).toBe("invalid_input");
  });

  test("rejects empty and over-long titles", async () => {
    expect(await code(createRecord(db, anna, { kind: "task", title: "   " }, now))).toBe("invalid_input");
    expect(await code(createRecord(db, anna, { kind: "task", title: "я".repeat(201) }, now))).toBe("invalid_input");
  });

  test("refuses past the per-user limit but not for another user", async () => {
    const values = Array.from({ length: MAX_RECORDS_PER_USER }, (_, i) => ({ userId: anna, kind: "task" as const, title: `t${i}`, createdAt: now.toJSDate(), updatedAt: now.toJSDate() }));
    const { records } = await import("@/db/schema");
    for (let i = 0; i < values.length; i += 200) await db.insert(records).values(values.slice(i, i + 200));
    expect(await code(createRecord(db, anna, { kind: "task", title: "ещё" }, now))).toBe("limit_reached");
    await expect(createRecord(db, boris, { kind: "task", title: "ещё" }, now)).resolves.toMatchObject({ title: "ещё" });
  });
});

describe("meeting conflicts (AC-14)", () => {
  async function meeting(userId: number, time: string, date = "2026-10-20") {
    return createRecord(db, userId, { kind: "meeting", title: `Встреча ${time}`, date, time }, now);
  }

  test("15:00 and 15:30 conflict, 16:00 and 14:00 do not", async () => {
    await meeting(anna, "15:00");
    expect(await findMeetingConflicts(db, anna, meetingStart("2026-10-20", "15:30"))).toHaveLength(1);
    expect(await findMeetingConflicts(db, anna, meetingStart("2026-10-20", "14:30"))).toHaveLength(1);
    expect(await findMeetingConflicts(db, anna, meetingStart("2026-10-20", "16:00"))).toHaveLength(0);
    expect(await findMeetingConflicts(db, anna, meetingStart("2026-10-20", "14:00"))).toHaveLength(0);
  });

  test("works across midnight", async () => {
    await meeting(anna, "23:30");
    expect(await findMeetingConflicts(db, anna, meetingStart("2026-10-21", "00:00"))).toHaveLength(1);
  });

  test("ignores other users, tasks and the excluded record", async () => {
    await meeting(boris, "15:00");
    await createRecord(db, anna, { kind: "task", title: "задача", date: "2026-10-20" }, now);
    const own = await meeting(anna, "15:00");
    expect(await findMeetingConflicts(db, anna, meetingStart("2026-10-20", "15:00"), own.id)).toHaveLength(0);
    expect(await findMeetingConflicts(db, anna, meetingStart("2026-10-20", "15:00"))).toHaveLength(1);
  });
});

describe("update, complete, delete are scoped to the owner", () => {
  test("setDone toggles the flag; another user gets not_found", async () => {
    const rec = await createRecord(db, anna, { kind: "task", title: "Секрет", date: "2026-10-20" }, now);
    expect(await code(setDone(db, boris, rec.id, true, now))).toBe("not_found");
    expect((await setDone(db, anna, rec.id, true, now)).done).toBe(true);
    expect((await setDone(db, anna, rec.id, false, now)).done).toBe(false);
  });

  test("moving a meeting to another day keeps the time", async () => {
    const rec = await createRecord(db, anna, { kind: "meeting", title: "Созвон", date: "2026-10-20", time: "15:00" }, now);
    const moved = await updateRecord(db, anna, rec.id, { date: "2026-10-22" }, now);
    expect(moved).toMatchObject({ date: "2026-10-22", time: "15:00" });
    expect(await code(updateRecord(db, anna, rec.id, { date: "2026-13-01" }, now))).toBe("invalid_input");
    expect(await code(updateRecord(db, boris, rec.id, { date: "2026-10-23" }, now))).toBe("not_found");
  });

  test("delete removes it for the owner only", async () => {
    const rec = await createRecord(db, anna, { kind: "task", title: "x" }, now);
    expect(await code(deleteRecord(db, boris, rec.id))).toBe("not_found");
    expect(await code(deleteRecord(db, anna, rec.id))).toBeNull();
    expect(await code(deleteRecord(db, anna, rec.id))).toBe("not_found");
  });
});

describe("lists", () => {
  test("Boris does not see Anna's records in period list or panel (AC-20)", async () => {
    await createRecord(db, anna, { kind: "task", title: "годовой план", date: "2026-10-20" }, now);
    expect(await listByPeriod(db, boris, "2026-10-20", "2026-10-21")).toHaveLength(0);
    expect((await upcomingPanel(db, boris, now)).items).toHaveLength(0);
    const panel = await upcomingPanel(db, anna, now);
    expect(panel).toMatchObject({ title: "Ближайшие", total: 1 });
  });

  test("panel skips the past, keeps undated, caps at 50 with the real total", async () => {
    await insertRaw(db, anna, { kind: "task", title: "старое", dueDate: "2026-10-01" }, now.toJSDate());
    await insertRaw(db, anna, { kind: "task", title: "без даты" }, now.toJSDate());
    for (let i = 0; i < 60; i++) await createRecord(db, anna, { kind: "task", title: `t${i}`, date: "2026-10-25" }, now);
    const panel = await upcomingPanel(db, anna, now);
    expect(panel.items).toHaveLength(50);
    expect(panel.total).toBe(61);
    expect(panel.items.map((i) => i.title)).not.toContain("старое");
  });
});

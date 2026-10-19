import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, test } from "vitest";
import { classifyCsvText, importCsv, parseCsv } from "./csv-import";
import { listAllRecords, listRecordsByDueRange } from "./records";
import { setupTestDb } from "./test-db";
import { getOrCreateUser } from "./users";

const content = readFileSync("docs/source/voice_assistant_events.csv", "utf8");
const rows = parseCsv(content);
const byId = (id: number) => rows.find((r) => r.id === id)!;
const at = new Date("2026-10-19T07:00:00Z");

describe("classifyCsvText (ADR-006)", () => {
  test("rows 14, 15, 16: planerka is a meeting, other work is a task", () => {
    expect(classifyCsvText(byId(14).text)).toBe("meeting");
    expect(classifyCsvText(byId(15).text)).toBe("task");
    expect(classifyCsvText(byId(16).text)).toBe("meeting");
  });
  test("row 94: «итоги встречи» inside the text is a task", () => {
    expect(classifyCsvText(byId(94).text)).toBe("task");
  });
  test("a text starting with «Встреча» is a meeting", () => {
    expect(classifyCsvText("Встреча с Иваном по CRM")).toBe("meeting");
    expect(classifyCsvText("Созвон с командой")).toBe("meeting");
    expect(classifyCsvText("Демо проекта по хакатону")).toBe("meeting");
  });
  test("«Напомнить…» is a reminder", () => {
    expect(classifyCsvText("Напомнить о платеже")).toBe("reminder");
  });
});

describe("parseCsv", () => {
  test("reads all 1000 rows and strips the BOM", () => {
    expect(rows).toHaveLength(1000);
    expect(rows[0]).toMatchObject({ id: 1, date: "2024-01-07", time: "14:45" });
  });
  test("rejects a malformed row", () => {
    expect(() => parseCsv("id,date,time,text\nx,y")).toThrow(/line 2/);
  });
});

describe("importCsv", () => {
  let db: Awaited<ReturnType<typeof setupTestDb>>;
  let userId: number;
  beforeEach(async () => {
    db = await setupTestDb();
    userId = (await getOrCreateUser(db, "Демо", at)).id;
  });

  test("imports 1000 records, not done, with Moscow time stored as UTC", async () => {
    expect(await importCsv(db, userId, rows, at)).toBe(1000);
    const all = await listAllRecords(db, userId);
    expect(all).toHaveLength(1000);
    expect(all.every((r) => r.done === false)).toBe(true);
    const r14 = all.find((r) => r.sourceId === 14)!;
    expect(r14).toMatchObject({ kind: "meeting", dueDate: "2024-01-26", title: "Провести планёрку по договору" });
    expect(r14.startsAt!.toISOString()).toBe("2024-01-26T08:00:00.000Z");
  });

  test("running twice creates no duplicates", async () => {
    await importCsv(db, userId, rows, at);
    expect(await importCsv(db, userId, rows, at)).toBe(0);
    expect(await listAllRecords(db, userId)).toHaveLength(1000);
  });

  test("26 January 2024 lists ids 14, 15, 16 in time order", async () => {
    await importCsv(db, userId, rows, at);
    const day = await listRecordsByDueRange(db, userId, "2024-01-26", "2024-01-27");
    expect(day.map((r) => r.sourceId)).toEqual([14, 15, 16]);
  });

  test("another user does not receive the rows and may import their own copy", async () => {
    await importCsv(db, userId, rows, at);
    const other = await getOrCreateUser(db, "Борис", at);
    expect(await listAllRecords(db, other.id)).toHaveLength(0);
    expect(await importCsv(db, other.id, rows.slice(0, 5), at)).toBe(5);
  });
});

import { beforeEach, expect, test } from "vitest";
import { setupTestDb } from "./test-db";
import { backfillNameKeys, getOrCreateUser, listUsers, normalizeName } from "./users";
import { users } from "./schema";

const now = new Date("2026-10-19T07:00:00Z");
let db: Awaited<ReturnType<typeof setupTestDb>>;
beforeEach(async () => {
  db = await setupTestDb();
});

test("«анна» and « Анна  » are one user; the first spelling is kept", async () => {
  const a = await getOrCreateUser(db, "Анна", now);
  const b = await getOrCreateUser(db, "  анна ", now);
  expect(b.id).toBe(a.id);
  expect(await listUsers(db)).toEqual([{ id: a.id, name: "Анна" }]);
});

test("ё and е are the same letter in names", () => {
  expect(normalizeName("Пётр")).toBe(normalizeName("петр"));
});

test("names outside 1-40 characters are rejected", async () => {
  await expect(getOrCreateUser(db, "   ", now)).rejects.toThrow(RangeError);
  await expect(getOrCreateUser(db, "я".repeat(41), now)).rejects.toThrow(RangeError);
});

test("backfillNameKeys repairs users created before name_key existed", async () => {
  await db.insert(users).values({ name: "Демо" });
  await backfillNameKeys(db);
  const demo = await getOrCreateUser(db, "демо", now);
  expect(demo.name).toBe("Демо");
  expect(await listUsers(db)).toHaveLength(1);
});

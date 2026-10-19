import { beforeEach, expect, test } from "vitest";
import { setupTestDb } from "@/db/test-db";
import { getOrCreateUser } from "@/db/users";
import { parseRecordId, resolveUser } from "./session";

let db: Awaited<ReturnType<typeof setupTestDb>>;
beforeEach(async () => {
  db = await setupTestDb();
});

test("resolveUser accepts an existing id and rejects garbage without throwing", async () => {
  const anna = await getOrCreateUser(db, "Анна", new Date());
  expect(await resolveUser(db, String(anna.id))).toEqual({ id: anna.id, name: "Анна" });
  for (const bad of [undefined, "", "abc", "-1", "0", "1.5", "99999", "1; drop table users"]) {
    expect(await resolveUser(db, bad)).toBeNull();
  }
});

test("find-or-create by name: 'анна' is the same user as ' Анна '", async () => {
  const a = await getOrCreateUser(db, "Анна", new Date());
  const b = await getOrCreateUser(db, "  анна ", new Date());
  expect(b.id).toBe(a.id);
});

test("parseRecordId accepts positive integers only", () => {
  expect(parseRecordId("12")).toBe(12);
  for (const bad of ["0", "-3", "x", "1.2", ""]) expect(parseRecordId(bad)).toBeNull();
});

import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "./client";
import { dialogMessages, dialogStates, records, users } from "./schema";

// Unit-test helpers: DATABASE_URL is file::memory: under Vitest (one database per test file).
let migrated = false;

export async function setupTestDb() {
  if (!migrated) {
    await migrate(db, { migrationsFolder: "./drizzle" });
    migrated = true;
  }
  await resetTestDb();
  return db;
}

export async function resetTestDb() {
  await db.delete(dialogStates);
  await db.delete(dialogMessages);
  await db.delete(records);
  await db.delete(users);
}

import { asc, eq } from "drizzle-orm";
import type { Db } from "./client";
import { users, type User } from "./schema";

/** Lower case, ё -> е, collapsed whitespace: "анна" and " Анна  " are one user. */
export function normalizeName(name: string): string {
  return name.toLowerCase().replaceAll("ё", "е").replace(/\s+/g, " ").trim();
}

export function listUsers(db: Db): Promise<Pick<User, "id" | "name">[]> {
  return db.select({ id: users.id, name: users.name }).from(users).orderBy(asc(users.name), asc(users.id));
}

export async function getUser(db: Db, id: number): Promise<User | null> {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}

/** Finds the user by normalized name or creates one; one atomic action (AC-20). */
export async function getOrCreateUser(db: Db, rawName: string, now: Date): Promise<User> {
  const name = rawName.trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 40) {
    throw new RangeError("User name must be 1-40 characters");
  }
  const nameKey = normalizeName(name);
  await db.insert(users).values({ name, nameKey, createdAt: now }).onConflictDoNothing({ target: users.nameKey });
  const [row] = await db.select().from(users).where(eq(users.nameKey, nameKey)).limit(1);
  return row!;
}

/** Repairs rows added before name_key existed (their key is ""). Idempotent. */
export async function backfillNameKeys(db: Db): Promise<void> {
  const stale = await db
    .select()
    .from(users)
    .where(eq(users.nameKey, ""));
  for (const user of stale) {
    await db.update(users).set({ nameKey: normalizeName(user.name) }).where(eq(users.id, user.id));
  }
}

import { and, asc, count, eq, gte, inArray, isNull, lt, or, sql } from "drizzle-orm";
import type { Db } from "./client";
import { records, type NewRecord, type RecordKind, type RecordRow } from "./schema";

// Every function takes userId first and puts it into WHERE, including update and delete by id.

export type RecordInput = Pick<NewRecord, "kind" | "title"> & Partial<Pick<NewRecord, "dueDate" | "startsAt" | "done">>;
export type RecordPatch = Partial<Pick<NewRecord, "kind" | "title" | "dueDate" | "startsAt" | "done">>;

// ADR-004 order: by day, whole-day records before timed ones, then time, then id; undated last.
const listOrder = [
  sql`${records.dueDate} IS NULL`,
  asc(records.dueDate),
  sql`${records.startsAt} IS NOT NULL`,
  asc(records.startsAt),
  asc(records.id),
];

export async function createRecord(db: Db, userId: number, input: RecordInput, now: Date): Promise<RecordRow> {
  const [row] = await db
    .insert(records)
    .values({ ...input, userId, createdAt: now, updatedAt: now })
    .returning();
  return row!;
}

export async function getRecord(db: Db, userId: number, id: number): Promise<RecordRow | null> {
  const [row] = await db
    .select()
    .from(records)
    .where(and(eq(records.userId, userId), eq(records.id, id)))
    .limit(1);
  return row ?? null;
}

export function getRecordsByIds(db: Db, userId: number, ids: number[]): Promise<RecordRow[]> {
  if (ids.length === 0) return Promise.resolve([]);
  return db
    .select()
    .from(records)
    .where(and(eq(records.userId, userId), inArray(records.id, ids)))
    .orderBy(...listOrder);
}

export async function updateRecord(
  db: Db,
  userId: number,
  id: number,
  patch: RecordPatch,
  now: Date,
): Promise<RecordRow | null> {
  const [row] = await db
    .update(records)
    .set({ ...patch, updatedAt: now })
    .where(and(eq(records.userId, userId), eq(records.id, id)))
    .returning();
  return row ?? null;
}

export async function deleteRecord(db: Db, userId: number, id: number): Promise<boolean> {
  const rows = await db
    .delete(records)
    .where(and(eq(records.userId, userId), eq(records.id, id)))
    .returning({ id: records.id });
  return rows.length > 0;
}

/** Records whose day is in the half-open range [fromDate, toDate) (YYYY-MM-DD, Moscow). */
export function listRecordsByDueRange(
  db: Db,
  userId: number,
  fromDate: string,
  toDate: string,
  kind?: RecordKind,
): Promise<RecordRow[]> {
  return db
    .select()
    .from(records)
    .where(
      and(
        eq(records.userId, userId),
        gte(records.dueDate, fromDate),
        lt(records.dueDate, toDate),
        kind ? eq(records.kind, kind) : undefined,
      ),
    )
    .orderBy(...listOrder);
}

/** "Nearest": dated from `today` on, plus undated ones. */
export function listUpcomingRecords(db: Db, userId: number, today: string, limit: number): Promise<RecordRow[]> {
  return db
    .select()
    .from(records)
    .where(and(eq(records.userId, userId), or(gte(records.dueDate, today), isNull(records.dueDate))))
    .orderBy(...listOrder)
    .limit(limit);
}

/** Everything the user owns; the search module filters it in TypeScript (ADR-005). */
export function listAllRecords(db: Db, userId: number): Promise<RecordRow[]> {
  return db
    .select()
    .from(records)
    .where(eq(records.userId, userId))
    .orderBy(...listOrder);
}

/** For the per-user record limit. */
export async function countRecords(db: Db, userId: number): Promise<number> {
  const [row] = await db.select({ n: count() }).from(records).where(eq(records.userId, userId));
  return row?.n ?? 0;
}

import { DateTime } from "luxon";
import type { Db } from "./client";
import { records, type NewRecord, type RecordKind } from "./schema";

// ADR-006: import of docs/source/voice_assistant_events.csv.

export type CsvRow = { id: number; date: string; time: string; text: string };

const CHUNK = 100;
const ROW = /^(\d+),(\d{4}-\d{2}-\d{2}),(\d{2}:\d{2}),(.+)$/;

/** Header `id,date,time,text`, comma separated, no quoting (checked: the file has no quotes). */
export function parseCsv(content: string): CsvRow[] {
  const lines = content.replace(/^﻿/, "").split(/\r?\n/);
  const rows: CsvRow[] = [];
  for (const [index, line] of lines.slice(1).entries()) {
    if (line.trim() === "") continue;
    const match = ROW.exec(line);
    if (!match) throw new Error(`Invalid CSV row at line ${index + 2}: ${line}`);
    rows.push({ id: Number(match[1]), date: match[2]!, time: match[3]!, text: match[4]!.trim() });
  }
  return rows;
}

/** "Встреча…", "созвон…", "демо…" or "…планерк…" -> meeting; "напомн…" -> reminder; else task. */
export function classifyCsvText(text: string): RecordKind {
  const t = text.toLowerCase().replaceAll("ё", "е").trim();
  if (/^(встреч|созвон|демо)/.test(t) || t.includes("планерк")) return "meeting";
  if (t.startsWith("напомн")) return "reminder";
  return "task";
}

export function csvRowToRecord(userId: number, row: CsvRow, importedAt: Date): NewRecord {
  const startsAt = DateTime.fromISO(`${row.date}T${row.time}`, { zone: "Europe/Moscow" });
  if (!startsAt.isValid) throw new Error(`Invalid date or time in CSV row ${row.id}`);
  return {
    userId,
    kind: classifyCsvText(row.text),
    title: row.text,
    dueDate: row.date,
    startsAt: new Date(startsAt.toMillis()),
    done: false,
    sourceId: row.id,
    createdAt: importedAt,
    updatedAt: importedAt,
  };
}

/** Idempotent: rows already imported for this user (same source_id) are skipped. Returns rows inserted. */
export async function importCsv(db: Db, userId: number, rows: CsvRow[], importedAt: Date): Promise<number> {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const values = rows.slice(i, i + CHUNK).map((row) => csvRowToRecord(userId, row, importedAt));
    const result = await db
      .insert(records)
      .values(values)
      .onConflictDoNothing({ target: [records.userId, records.sourceId] })
      .returning({ id: records.id });
    inserted += result.length;
  }
  return inserted;
}

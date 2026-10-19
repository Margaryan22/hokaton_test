import { DateTime } from "luxon";
import type { Db } from "@/db/client";
import { MAX_RECORDS_PER_USER } from "@/db/limits";
import {
  countRecords,
  createRecord as insertRecord,
  deleteRecord as removeRecord,
  getRecord,
  listRecordsByDueRange,
  listUpcomingRecords,
  updateRecord as patchRecord,
  type RecordPatch,
} from "@/db/records";
import type { RecordRow } from "@/db/schema";
import type { Panel, RecordDto, RecordKind } from "@/shared/api";
import { APP_ZONE } from "../clock";
import { ServiceError } from "./errors";

/** A meeting occupies one hour (docs/architecture.md §2); the length is not stored. */
export const MEETING_MINUTES = 60;
export const PANEL_LIMIT = 50;
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

export type NewRecordInput = {
  kind: RecordKind;
  title: string;
  /** Moscow day `YYYY-MM-DD`. */
  date?: string | null;
  /** Moscow wall-clock `HH:mm`. */
  time?: string | null;
};

export type EditRecordInput = Partial<NewRecordInput>;

const invalid = (message: string) => new ServiceError("invalid_input", message);

export function toRecordDto(row: RecordRow): RecordDto {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    date: row.dueDate,
    time: row.startsAt ? DateTime.fromJSDate(row.startsAt).setZone(APP_ZONE).toFormat("HH:mm") : null,
    done: row.done,
  };
}

/** Validates the title, the day and the time; returns the values for storage. Throws ServiceError("invalid_input"). */
function normalizeSlots(input: NewRecordInput): { title: string; dueDate: string | null; startsAt: Date | null } {
  const title = (input.title ?? "").trim().replace(/\s+/g, " ");
  if (title.length < 1) throw invalid("Укажите название записи");
  if (title.length > 200) throw invalid("Название слишком длинное (не больше 200 символов)");

  const date = input.date ?? null;
  const time = input.time ?? null;
  let day: DateTime | null = null;
  if (date !== null) {
    day = /^\d{4}-\d{2}-\d{2}$/.test(date) ? DateTime.fromISO(date, { zone: APP_ZONE }) : DateTime.invalid("bad format");
    if (!day.isValid || day.year < MIN_YEAR || day.year > MAX_YEAR) throw invalid("Не удалось разобрать дату");
  }
  if (time !== null && date === null) throw invalid("Время нужно указывать вместе с датой");
  if ((input.kind === "meeting" || input.kind === "reminder") && (date === null || time === null)) {
    throw invalid(input.kind === "meeting" ? "Для встречи нужны дата и время" : "Для напоминания нужны дата и время");
  }

  let startsAt: Date | null = null;
  if (day && time !== null) {
    const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(time);
    if (!match) throw invalid("Не удалось разобрать время");
    const moment = day.set({ hour: Number(match[1]), minute: Number(match[2]) });
    if (!moment.isValid) throw invalid("Не удалось разобрать время");
    startsAt = moment.toJSDate();
  }
  return { title, dueDate: day ? day.toISODate() : null, startsAt };
}

export async function createRecord(db: Db, userId: number, input: NewRecordInput, now: DateTime): Promise<RecordDto> {
  const slots = normalizeSlots(input);
  if ((await countRecords(db, userId)) >= MAX_RECORDS_PER_USER) {
    throw new ServiceError("limit_reached", "Достигнут лимит записей");
  }
  const row = await insertRecord(db, userId, { kind: input.kind, ...slots }, now.toJSDate());
  return toRecordDto(row);
}

/** Changes title, kind, day or time of the user's own record; merges with the current values and validates the result. */
export async function updateRecord(
  db: Db,
  userId: number,
  id: number,
  changes: EditRecordInput,
  now: DateTime,
): Promise<RecordDto> {
  const current = await getRecord(db, userId, id);
  if (!current) throw notFound();
  const currentDto = toRecordDto(current);
  const merged: NewRecordInput = {
    kind: changes.kind ?? current.kind,
    title: changes.title ?? current.title,
    date: changes.date !== undefined ? changes.date : currentDto.date,
    time: changes.time !== undefined ? changes.time : currentDto.time,
  };
  // Moving to another day without a new time keeps the old time of day.
  const slots = normalizeSlots(merged);
  const patch: RecordPatch = { kind: merged.kind, ...slots };
  const row = await patchRecord(db, userId, id, patch, now.toJSDate());
  if (!row) throw notFound();
  return toRecordDto(row);
}

export async function setDone(db: Db, userId: number, id: number, done: boolean, now: DateTime): Promise<RecordDto> {
  const row = await patchRecord(db, userId, id, { done }, now.toJSDate());
  if (!row) throw notFound();
  return toRecordDto(row);
}

export async function deleteRecord(db: Db, userId: number, id: number): Promise<void> {
  if (!(await removeRecord(db, userId, id))) throw notFound();
}

/** Records with a day in [fromDate, toDate), Moscow `YYYY-MM-DD`. */
export async function listByPeriod(
  db: Db,
  userId: number,
  fromDate: string,
  toDate: string,
  kind?: RecordKind,
): Promise<RecordDto[]> {
  return (await listRecordsByDueRange(db, userId, fromDate, toDate, kind)).map(toRecordDto);
}

/** The default right-hand column: from today on plus undated ones, up to 50. */
export async function upcomingPanel(db: Db, userId: number, now: DateTime): Promise<Panel> {
  const today = now.setZone(APP_ZONE).toISODate()!;
  const rows = await listUpcomingRecords(db, userId, today, MAX_RECORDS_PER_USER);
  return { title: "Ближайшие", items: rows.slice(0, PANEL_LIMIT).map(toRecordDto), total: rows.length };
}

/** The user's meetings that overlap a one-hour meeting starting at `startsAt` (back-to-back is no conflict). */
export async function findMeetingConflicts(
  db: Db,
  userId: number,
  startsAt: Date,
  excludeId?: number,
): Promise<RecordDto[]> {
  const day = DateTime.fromJSDate(startsAt).setZone(APP_ZONE).startOf("day");
  const rows = await listRecordsByDueRange(db, userId, day.minus({ days: 1 }).toISODate()!, day.plus({ days: 2 }).toISODate()!, "meeting");
  const span = MEETING_MINUTES * 60_000;
  return rows
    .filter((r) => r.startsAt !== null && r.id !== excludeId && Math.abs(r.startsAt.getTime() - startsAt.getTime()) < span)
    .map(toRecordDto);
}

/** Same check from the Moscow day and time the dialog collected. Invalid input throws. */
export function meetingStart(date: string, time: string): Date {
  return normalizeSlots({ kind: "meeting", title: "x", date, time }).startsAt!;
}

function notFound() {
  return new ServiceError("not_found", "Запись не найдена");
}

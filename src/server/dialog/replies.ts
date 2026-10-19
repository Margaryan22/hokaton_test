import type { RecordDto, RecordKind } from "@/shared/api";
import { formatDate, formatDateTime, formatTime, MONTHS_GENITIVE } from "@/shared/format";
import type { Op } from "./state";

// Reply templates, docs/architecture.md §7. Dates: «20 октября», the year only when it is not the current one.

export const LIST_LIMIT = 10;

export const NOT_UNDERSTOOD =
  "Не понял запрос. Например: «Напомни завтра в 10 позвонить Ивану», «Что у меня на этой неделе?», «Найди задачу про отчёт»";
export const NOTHING_TO_CONFIRM = "Сейчас нечего подтверждать. Что сделать?";
export const CANCELLED = "Хорошо, отменил.";
export const NOT_FOUND_ANY = "Не нашёл подходящую запись. Попробуйте уточнить название.";
export const SEARCH_EMPTY = "Ничего не нашёл. Попробуйте уточнить запрос: другое слово или период";
export const SEARCH_NEEDS_WORDS = "Что найти? Например: «Найди задачу про отчёт»";

type Forms = readonly [string, string, string];

function plural(n: number, [one, few, many]: Forms): string {
  const m100 = n % 100;
  const m10 = n % 10;
  if (m100 >= 11 && m100 <= 14) return many;
  if (m10 === 1) return one;
  if (m10 >= 2 && m10 <= 4) return few;
  return many;
}

type KindKey = RecordKind | "any";
const NOMINATIVE: Record<KindKey, Forms> = {
  task: ["задача", "задачи", "задач"],
  meeting: ["встреча", "встречи", "встреч"],
  reminder: ["напоминание", "напоминания", "напоминаний"],
  any: ["запись", "записи", "записей"],
};
const ACCUSATIVE: Record<KindKey, Forms> = {
  task: ["задачу", "задачи", "задач"],
  meeting: ["встречу", "встречи", "встреч"],
  reminder: ["напоминание", "напоминания", "напоминаний"],
  any: ["запись", "записи", "записей"],
};
/** Singular accusative: «Удалить задачу …». */
const SINGLE_ACC: Record<RecordKind, string> = { task: "задачу", meeting: "встречу", reminder: "напоминание" };

const VERB: Record<Op, string> = { delete: "удалить", complete: "отметить выполненной", update: "перенести" };

export function dateLabel(date: string, time: string | null, today: string): string {
  return formatDateTime(date, time, today).replace(", ", " в ");
}

// --- create ---------------------------------------------------------------------

export function reminderCreated(date: string, time: string, title: string, today: string): string {
  return `Напомню ${formatDate(date, today)} в ${formatTime(time)}: ${title}`;
}

export function taskCreated(title: string, date: string | undefined, time: string | undefined, hasDeadline: boolean, today: string): string {
  if (!date) return `Добавил задачу «${title}» без срока`;
  const when = time ? `${formatDate(date, today)} в ${formatTime(time)}` : formatDate(date, today);
  return hasDeadline ? `Добавил задачу «${title}» со сроком до ${when}` : `Добавил задачу «${title}» на ${when}`;
}

export function meetingCreated(title: string, date: string, time: string, today: string): string {
  return `Поставил встречу «${title}» на ${formatDate(date, today)} в ${formatTime(time)}`;
}

export function conflictQuestion(conflict: RecordDto, today: string, forUpdate: boolean): string {
  const when = conflict.date ? ` ${dateLabel(conflict.date, conflict.time, today)}` : "";
  return `В это время уже есть встреча «${conflict.title}»${when}. Всё равно ${forUpdate ? "перенести" : "поставить"}?`;
}

export function askSlot(kind: RecordKind, missing: { title: boolean; date: boolean; time: boolean }): string {
  if (missing.title) return kind === "reminder" ? "О чём напомнить?" : "Что нужно сделать?";
  const noun = kind === "meeting" ? "поставить встречу" : "напомнить";
  if (missing.date && missing.time) return `Когда ${noun}?`;
  if (missing.date) return `На какой день ${noun}?`;
  return kind === "meeting" ? "На какое время поставить встречу?" : "Во сколько напомнить?";
}

// --- operations on one record ------------------------------------------------------

export function askDelete(kind: RecordKind, title: string): string {
  return `Удалить ${SINGLE_ACC[kind]} «${title}»?`;
}
export const deleted = (kind: RecordKind, title: string) => `Удалил ${SINGLE_ACC[kind]} «${title}».`;
export const completed = (kind: RecordKind, title: string) => `Отметил ${SINGLE_ACC[kind]} «${title}» выполненной`;
export const alreadyDone = (title: string) => `Запись «${title}» уже выполнена`;

export function moved(kind: RecordKind, title: string, date: string, time: string | null, today: string): string {
  return `Перенёс ${SINGLE_ACC[kind]} «${title}» на ${dateLabel(date, time, today)}`;
}

export const askTarget = (op: Op) => `Какую запись ${VERB[op]}?`;
export const askMoveWhen = "На какой день или время перенести?";

export function askChoice(op: Op, candidates: RecordDto[], today: string): string {
  const kinds = new Set(candidates.map((c) => c.kind));
  const key: KindKey = kinds.size === 1 ? candidates[0]!.kind : "any";
  const lines = candidates.map((c, i) => `${i + 1}. ${c.title}${c.date ? ` (${formatDateTime(c.date, c.time, today)})` : ""}`);
  return `Нашёл несколько ${NOMINATIVE[key][2]}: ${lines.join("; ")}. Какую ${VERB[op]}?`;
}

export const choiceOutOfRange = (n: number) => `Введите номер от 1 до ${n}.`;

// --- lists and search -----------------------------------------------------------------

export type LineStyle = "time" | "datetime";

function line(item: RecordDto, index: number, style: LineStyle, today: string): string {
  let when = "";
  if (style === "datetime") when = item.date ? `${formatDateTime(item.date, item.time, today)} ` : "";
  else if (item.time) when = `${item.time} `;
  return `${index + 1}. ${when}${item.title}${item.done ? " (выполнено)" : ""}`;
}

/** «1. a; 2. b; …и ещё N» — at most LIST_LIMIT records. */
export function enumerate(items: RecordDto[], total: number, style: LineStyle, today: string): string {
  const shown = items.slice(0, LIST_LIMIT);
  const parts = shown.map((item, i) => line(item, i, style, today));
  const more = total - shown.length;
  if (more > 0) parts.push(`…и ещё ${more}`);
  return parts.join("; ");
}

export function listReply(prefix: string, items: RecordDto[], total: number, style: LineStyle, today: string): string {
  return `${prefix}: ${enumerate(items, total, style, today)}`;
}

export const emptyPeriod = (label: string) => `На ${label} ничего не запланировано`;
export const emptyUpcoming = "Ближайших записей нет";

export function existsReply(kind: RecordKind | undefined, when: string, items: RecordDto[], total: number, style: LineStyle, today: string): string {
  const key: KindKey = kind ?? "any";
  if (total === 0) return `Нет, ${when} ${NOMINATIVE[key][2]} нет`;
  return `Да, ${when} ${total} ${plural(total, NOMINATIVE[key])}: ${enumerate(items, total, style, today)}`;
}

/** Search covers the whole history, so the year is always shown: «5 марта 2026». */
function fullDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return `${day} ${MONTHS_GENITIVE[(month ?? 1) - 1]} ${year}`;
}

export function searchReply(kind: RecordKind | undefined, items: RecordDto[], total: number): string {
  const key: KindKey = kind ?? "any";
  const lines = items.map((item, i) => {
    const when = item.date ? ` — ${fullDate(item.date)}${item.time ? `, ${formatTime(item.time)}` : ""}` : "";
    return `${i + 1}. ${item.title}${when}`;
  });
  const head =
    total > items.length
      ? `Нашёл ${total} ${plural(total, ACCUSATIVE[key])}, показываю ${items.length}`
      : `Нашёл ${total} ${plural(total, ACCUSATIVE[key])}`;
  return `${head}: ${lines.join("; ")}`;
}

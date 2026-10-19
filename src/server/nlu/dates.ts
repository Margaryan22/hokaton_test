import { DateTime } from "luxon";
import { APP_ZONE } from "@/server/clock";
import { MONTHS_GENITIVE, formatDate } from "@/shared/format";
import type { Token } from "./normalize";
import type { Period } from "./types";

/**
 * Dates and times in Russian phrases (docs/architecture.md §5), relative to the injected `now`, Europe/Moscow.
 * Functions mark the tokens they consume in `used` so the title can be built from what is left.
 */

export type When = {
  date?: string;
  /** `HH:mm` */
  time?: string;
  /** The date came from «до …». */
  deadline: boolean;
};

const WEEKDAYS: Record<string, number> = {
  понедельник: 1,
  понедельника: 1,
  вторник: 2,
  вторника: 2,
  среда: 3,
  среду: 3,
  среды: 3,
  четверг: 4,
  четверга: 4,
  пятница: 5,
  пятницу: 5,
  пятницы: 5,
  суббота: 6,
  субботу: 6,
  субботы: 6,
  воскресенье: 7,
  воскресенья: 7,
};

const DAY_PREPS = new Set(["в", "во", "на", "до", "к"]);
const TIME_PREPS = new Set(["в", "на", "к", "около"]);
/** A number followed by one of these is a quantity, not a clock hour. */
const NOT_A_HOUR = ["мин", "дн", "ден", "раз", "недел", "месяц", "год", "человек", "штук", "сек"];

function local(now: DateTime): DateTime {
  return now.setZone(APP_ZONE);
}

const pad = (n: number): string => String(n).padStart(2, "0");
const hhmm = (h: number, m: number): string => `${pad(h)}:${pad(m)}`;

function isoDate(dt: DateTime): string {
  return dt.toISODate() ?? "";
}

function hour24(h: number, partOfDay?: string): number {
  switch (partOfDay) {
    case "утра":
      return h === 12 ? 0 : h;
    case "дня":
      return h >= 1 && h <= 6 ? h + 12 : h;
    case "вечера":
      return h < 12 ? h + 12 : h;
    case "ночи":
      return h === 12 ? 0 : h >= 9 ? h + 12 : h;
    default:
      return h >= 1 && h <= 7 ? h + 12 : h;
  }
}

const PARTS_OF_DAY = new Set(["утра", "дня", "вечера", "ночи"]);
const DAYTIME_WORDS: Record<string, string> = { утром: "09:00", днем: "13:00", вечером: "19:00" };

/** Nearest future weekday (today does not count). */
function nextWeekday(today: DateTime, weekday: number): DateTime {
  const delta = (weekday - today.weekday + 7) % 7 || 7;
  return today.plus({ days: delta });
}

function validDate(year: number, month: number, day: number): DateTime | undefined {
  const dt = DateTime.fromObject({ year, month, day }, { zone: APP_ZONE });
  return dt.isValid ? dt : undefined;
}

/** Label for «На <label> ничего не запланировано»: сегодня / завтра / послезавтра / «26 января 2024». */
export function dayLabel(date: string, now: DateTime): string {
  const today = local(now).startOf("day");
  const diff = Math.round(DateTime.fromISO(date, { zone: APP_ZONE }).diff(today, "days").days);
  if (diff === 0) return "сегодня";
  if (diff === 1) return "завтра";
  if (diff === 2) return "послезавтра";
  if (diff === -1) return "вчера";
  return formatDate(date, isoDate(today));
}

export type WhenOptions = {
  /** Accept a lone number as an hour (answer to «На какое время…?»). */
  bareHour?: boolean;
};

export function extractWhen(tokens: Token[], used: Set<number>, now: DateTime, options: WhenOptions = {}): When {
  const today = local(now).startOf("day");
  const when: When = { deadline: false };
  const free = (i: number): boolean => i >= 0 && i < tokens.length && !used.has(i);
  const take = (...indexes: number[]): void => indexes.forEach((i) => used.add(i));
  const prevPrep = (i: number, preps: Set<string>): number | undefined =>
    free(i - 1) && preps.has(tokens[i - 1]!.t) ? i - 1 : undefined;

  // 1. «через …»: relative to now
  for (let i = 0; i < tokens.length && when.date === undefined; i++) {
    if (!free(i) || tokens[i]!.t !== "через") continue;
    const a = tokens[i + 1];
    const b = tokens[i + 2];
    if (!a || used.has(i + 1)) continue;
    let amount: { hours?: number; minutes?: number; days?: number } | undefined;
    let length = 2;
    if (a.t === "полчаса") amount = { minutes: 30 };
    else if (a.t === "час") amount = { hours: 1 };
    else if (a.t.startsWith("минут")) amount = { minutes: 1 };
    else if (a.t === "день") amount = { days: 1 };
    else if (a.t.startsWith("недел")) amount = { days: 7 };
    else if (a.n !== undefined && b && !used.has(i + 2)) {
      length = 3;
      if (b.t.startsWith("час")) amount = { hours: a.n };
      else if (b.t.startsWith("минут")) amount = { minutes: a.n };
      else if (b.t.startsWith("ден") || b.t.startsWith("дн")) amount = { days: a.n };
      else if (b.t.startsWith("недел")) amount = { days: a.n * 7 };
    }
    if (!amount) continue;
    if (amount.days !== undefined) {
      when.date = isoDate(today.plus({ days: amount.days }));
    } else {
      const at = local(now).plus(amount);
      when.date = isoDate(at);
      when.time = hhmm(at.hour, at.minute);
    }
    for (let k = 0; k < length; k++) take(i + k);
  }

  // 2. calendar date
  for (let i = 0; i < tokens.length && when.date === undefined; i++) {
    if (!free(i)) continue;
    const tok = tokens[i]!;
    const prep = prevPrep(i, DAY_PREPS);
    const deadlineByPrep = prep !== undefined && tokens[prep]!.t === "до";
    let date: DateTime | undefined;
    let consumed: number[] = [i];

    if (tok.t === "сегодня") date = today;
    else if (tok.t === "завтра") date = today.plus({ days: 1 });
    else if (tok.t === "послезавтра") date = today.plus({ days: 2 });
    else if (tok.t === "вчера") date = today.minus({ days: 1 });
    else if (tok.t === "после" && tokens[i + 1]?.t === "завтра" && free(i + 1)) {
      date = today.plus({ days: 2 });
      consumed = [i, i + 1];
    } else if (tok.t === "конца" && prep !== undefined && tokens[prep]!.t === "до" && free(i + 1)) {
      const unit = tokens[i + 1]!.t;
      if (unit.startsWith("недел")) date = today.endOf("week").startOf("day");
      else if (unit.startsWith("месяц")) date = today.endOf("month").startOf("day");
      consumed = [i, i + 1];
    } else if (tok.t in WEEKDAYS && prep !== undefined) {
      date = nextWeekday(today, WEEKDAYS[tok.t]!);
    } else if (tok.n !== undefined && tok.n >= 1 && tok.n <= 31 && free(i + 1) && MONTHS_GENITIVE.includes(tokens[i + 1]!.t as never)) {
      const month = MONTHS_GENITIVE.indexOf(tokens[i + 1]!.t as never) + 1;
      consumed = [i, i + 1];
      const yearToken = tokens[i + 2];
      if (yearToken && free(i + 2) && yearToken.digits && yearToken.n !== undefined && yearToken.n >= 2000 && yearToken.n <= 2100) {
        date = validDate(yearToken.n, month, tok.n);
        consumed.push(i + 2);
        const suffix = tokens[i + 3];
        if (suffix && free(i + 3) && (suffix.t === "года" || suffix.t === "г" || suffix.t === "год")) consumed.push(i + 3);
      } else {
        date = validDate(today.year, month, tok.n);
        if (date && date < today) date = validDate(today.year + 1, month, tok.n);
      }
    }
    if (!date) continue;
    when.date = isoDate(date);
    when.deadline = deadlineByPrep;
    take(...consumed);
    if (prep !== undefined) take(prep);
  }

  // 3. time of day
  for (let i = 0; i < tokens.length && when.time === undefined; i++) {
    if (!free(i)) continue;
    const tok = tokens[i]!;
    const prep = prevPrep(i, TIME_PREPS);
    let h: number | undefined;
    let m = 0;
    let consumed: number[] = [i];
    let cursor = i + 1;

    if (tok.clock) {
      h = tok.clock.h;
      m = tok.clock.m;
      const partOfDay = free(cursor) ? tokens[cursor]!.t : undefined;
      if (partOfDay && PARTS_OF_DAY.has(partOfDay)) {
        h = hour24(h, partOfDay);
        consumed.push(cursor);
      } else if (!tok.t.startsWith("0") && h >= 1 && h <= 7) {
        h += 12;
      }
    } else if (tok.t === "полдень" && prep !== undefined) {
      h = 12;
    } else if (tok.t === "полночь" && prep !== undefined) {
      h = 0;
    } else if (tok.t in DAYTIME_WORDS) {
      const [hh, mm] = DAYTIME_WORDS[tok.t]!.split(":").map(Number);
      h = hh!;
      m = mm!;
    } else if (prep !== undefined && tok.n !== undefined && tok.n >= 0 && tok.n <= 23) {
      const next = tokens[cursor];
      if (next && free(cursor) && !PARTS_OF_DAY.has(next.t) && NOT_A_HOUR.some((p) => next.t.startsWith(p))) continue;
      h = tok.n;
      if (next && free(cursor) && next.t.startsWith("час")) {
        consumed.push(cursor);
        cursor++;
      }
      const minutes = tokens[cursor];
      if (minutes && free(cursor) && minutes.n !== undefined && minutes.n >= 10 && minutes.n <= 59) {
        const after = tokens[cursor + 1];
        if (!(after && NOT_A_HOUR.some((p) => after.t.startsWith(p))) && !MONTHS_GENITIVE.includes(after?.t as never)) {
          m = minutes.n;
          consumed.push(cursor);
          cursor++;
        }
      }
      const partOfDay = tokens[cursor];
      if (partOfDay && free(cursor) && PARTS_OF_DAY.has(partOfDay.t)) {
        h = hour24(h, partOfDay.t);
        consumed.push(cursor);
      } else {
        h = hour24(h);
      }
    } else {
      continue;
    }
    when.time = hhmm(h, m);
    if (prep !== undefined) consumed = [prep, ...consumed];
    take(...consumed);
  }

  // 4. a lone number as an hour («15», «в 3 часа» already handled above)
  if (options.bareHour && when.time === undefined) {
    const rest = tokens.map((_, i) => i).filter(free);
    const numeric = rest.filter((i) => tokens[i]!.n !== undefined);
    const others = rest.filter((i) => tokens[i]!.n === undefined);
    const n = numeric.length === 1 ? tokens[numeric[0]!]!.n! : undefined;
    if (n !== undefined && n >= 0 && n <= 23 && others.every((i) => tokens[i]!.t.startsWith("час"))) {
      when.time = hhmm(hour24(n), 0);
      take(...rest);
    }
  }

  return when;
}

/** Date and time of a new record: a time without a date means today, or tomorrow when it has already passed. */
export function defaultDate(when: When, now: DateTime): When {
  if (when.date !== undefined || when.time === undefined) return when;
  const current = local(now);
  const [h = 0, m = 0] = when.time.split(":").map(Number);
  const passed = h < current.hour || (h === current.hour && m <= current.minute);
  return { ...when, date: isoDate(passed ? current.plus({ days: 1 }) : current) };
}

const THIS_WEEK = new Set(["эту", "этой", "эта", "текущей", "текущую"]);
const NEXT_WEEK = new Set(["следующей", "следующую", "следующая", "будущей", "будущую"]);

/** The period asked for by «Что у меня …»: a day, a week, the weekend. Without one the list is «Ближайшие». */
export function extractPeriod(tokens: Token[], used: Set<number>, now: DateTime): Period | undefined {
  const monday = local(now).startOf("week");

  for (let i = 0; i < tokens.length; i++) {
    if (used.has(i) || !tokens[i]!.t.startsWith("недел")) continue;
    const modifier = tokens[i - 1]?.t ?? "";
    let start: DateTime | undefined;
    let label = "";
    if (NEXT_WEEK.has(modifier)) {
      start = monday.plus({ weeks: 1 });
      label = "следующую неделю";
    } else if (THIS_WEEK.has(modifier) || modifier === "на") {
      start = monday;
      label = "эту неделю";
    }
    if (!start) continue;
    used.add(i);
    if (i > 0) used.add(i - 1);
    return { from: isoDate(start), to: isoDate(start.plus({ weeks: 1 })), label };
  }

  const weekend = tokens.findIndex((tok, i) => !used.has(i) && tok.t.startsWith("выходн"));
  if (weekend >= 0) {
    used.add(weekend);
    const saturday = monday.plus({ days: 5 });
    return { from: isoDate(saturday), to: isoDate(monday.plus({ weeks: 1 })), label: "выходные" };
  }

  const when = extractWhen(tokens, used, now);
  if (when.date) {
    const day = DateTime.fromISO(when.date, { zone: APP_ZONE });
    return { from: when.date, to: isoDate(day.plus({ days: 1 })), label: dayLabel(when.date, now) };
  }
  return undefined;
}

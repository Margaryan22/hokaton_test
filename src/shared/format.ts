/** Russian date/time formatting shared by assistant replies and the UI (docs/architecture.md §7). Pure string work. */

export const MONTHS_GENITIVE = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
] as const;

/** «20 октября»; the year is added when it differs from the year of `today` («26 января 2024»). Both dates are `YYYY-MM-DD`. */
export function formatDate(isoDate: string, today: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const monthName = MONTHS_GENITIVE[(month ?? 1) - 1] ?? "";
  const base = `${day} ${monthName}`;
  return year === Number(today.slice(0, 4)) ? base : `${base} ${year}`;
}

/** `H:mm` or `HH:mm` -> `HH:mm`. */
export function formatTime(time: string): string {
  const [h = "0", m = "00"] = time.split(":");
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
}

/** «20 октября, 10:00»; without a time just the date. */
export function formatDateTime(isoDate: string, time: string | null, today: string): string {
  const date = formatDate(isoDate, today);
  return time ? `${date}, ${formatTime(time)}` : date;
}

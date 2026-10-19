import { DateTime } from "luxon";

/** Every date the app reasons about is in Moscow time. */
export const APP_ZONE = "Europe/Moscow";

/**
 * The current moment in Europe/Moscow.
 * APP_NOW (ISO 8601 with offset, e.g. 2026-10-19T10:00:00+03:00) freezes it for tests and demos.
 * Business code takes `now` as a parameter and gets it from here only at the API boundary.
 */
export function now(env: Record<string, string | undefined> = process.env): DateTime {
  const fixed = env.APP_NOW?.trim();
  if (fixed) {
    const parsed = DateTime.fromISO(fixed, { setZone: true });
    if (!parsed.isValid) {
      throw new Error(`APP_NOW is not a valid ISO 8601 date-time: ${fixed}`);
    }
    return parsed.setZone(APP_ZONE);
  }
  return DateTime.now().setZone(APP_ZONE);
}

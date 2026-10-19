import { describe, expect, it } from "vitest";
import { APP_ZONE, now } from "./clock";

describe("now", () => {
  it("returns the frozen moment from APP_NOW in Moscow time", () => {
    const moment = now({ APP_NOW: "2026-10-19T07:00:00Z" });
    expect(moment.zoneName).toBe(APP_ZONE);
    expect(moment.toISO()).toBe("2026-10-19T10:00:00.000+03:00");
  });

  it("uses the real clock when APP_NOW is empty", () => {
    const moment = now({});
    expect(moment.zoneName).toBe(APP_ZONE);
    expect(Math.abs(moment.toMillis() - Date.now())).toBeLessThan(5000);
  });

  it("rejects an invalid APP_NOW", () => {
    expect(() => now({ APP_NOW: "вчера" })).toThrow(/APP_NOW/);
  });
});

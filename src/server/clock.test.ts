import { describe, expect, it, vi } from "vitest";
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

  it("ignores APP_NOW and warns when VERCEL_ENV=production", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const moment = now({ APP_NOW: "2020-01-01T00:00:00Z", VERCEL_ENV: "production" });
    expect(Math.abs(moment.toMillis() - Date.now())).toBeLessThan(5000);
    expect(warn).toHaveBeenCalledTimes(1);
    now({ APP_NOW: "2020-01-01T00:00:00Z", VERCEL_ENV: "production" });
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("honours APP_NOW on preview and when VERCEL_ENV is unset", () => {
    expect(now({ APP_NOW: "2026-10-19T07:00:00Z", VERCEL_ENV: "preview" }).toISO()).toBe("2026-10-19T10:00:00.000+03:00");
  });
});

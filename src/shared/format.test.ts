import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatTime } from "./format";

const TODAY = "2026-10-19";

describe("format", () => {
  it("writes the day and the month in the genitive case", () => {
    expect(formatDate("2026-10-20", TODAY)).toBe("20 октября");
    expect(formatDate("2026-01-05", TODAY)).toBe("5 января");
  });
  it("adds the year when it is not the current one", () => {
    expect(formatDate("2024-01-26", TODAY)).toBe("26 января 2024");
    expect(formatDate("2027-03-20", TODAY)).toBe("20 марта 2027");
  });
  it("formats time as HH:mm", () => {
    expect(formatTime("09:05")).toBe("09:05");
    expect(formatTime("9:05")).toBe("09:05");
  });
  it("joins date and time", () => {
    expect(formatDateTime("2025-04-04", "18:00", TODAY)).toBe("4 апреля 2025, 18:00");
    expect(formatDateTime("2026-10-20", "10:00", TODAY)).toBe("20 октября, 10:00");
    expect(formatDateTime("2026-10-20", null, TODAY)).toBe("20 октября");
  });
});

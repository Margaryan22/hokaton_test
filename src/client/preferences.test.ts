import { describe, expect, it } from "vitest";
import { parseSound } from "./preferences";

describe("parseSound", () => {
  it("is on by default and when stored as on", () => {
    expect(parseSound(null)).toBe(true);
    expect(parseSound("on")).toBe(true);
  });
  it("is off only when stored as off", () => {
    expect(parseSound("off")).toBe(false);
  });
});

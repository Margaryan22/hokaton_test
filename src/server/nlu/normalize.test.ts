import { describe, expect, it } from "vitest";
import { normalize, tokenize } from "./normalize";

describe("normalize", () => {
  it("lower-cases, replaces ё and drops punctuation", () => {
    expect(normalize("Найди задачу про ОТЧЁТЫ!")).toBe("найди задачу про отчеты");
  });
  it("turns number words into digits", () => {
    expect(normalize("через два часа")).toBe("через 2 часа");
    expect(normalize("в двадцать пять минут")).toBe("в 25 минут");
  });
  it("keeps clock times together", () => {
    expect(normalize("в 14:30")).toBe("в 14:30");
  });
  it("splits hyphenated words", () => {
    expect(normalize("когда-то")).toBe("когда то");
  });
});

describe("tokenize", () => {
  it("keeps positions in the original string", () => {
    const text = "Позвонить Ивану, срочно";
    const tokens = tokenize(text);
    expect(tokens.map((t) => t.t)).toEqual(["позвонить", "ивану", "срочно"]);
    expect(tokens.map((t) => text.slice(t.start, t.end))).toEqual(["Позвонить", "Ивану", "срочно"]);
  });
  it("gives numbers a value", () => {
    const [a, b, c] = tokenize("5 пять 14:30");
    expect(a?.n).toBe(5);
    expect(b?.n).toBe(5);
    expect(c?.clock).toEqual({ h: 14, m: 30 });
  });
});

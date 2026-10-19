import { readFileSync } from "node:fs";
import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { classifyCsvText, csvRowToRecord, parseCsv } from "@/db/csv-import";
import { parse } from "../nlu/parse";
import { resolveTargets, searchRecords, type SearchableRecord } from "./rank";
import { areSynonyms } from "./synonyms";
import { stem } from "./stem";

const NOW = DateTime.fromISO("2026-10-19T10:00:00", { zone: "Europe/Moscow" });
const csv = readFileSync("docs/source/voice_assistant_events.csv", "utf8");
const imported = new Date("2026-10-19T07:00:00Z");
const ALL: (SearchableRecord & { done: boolean })[] = parseCsv(csv).map((row) => {
  const r = csvRowToRecord(1, row, imported);
  return { id: row.id, kind: r.kind, title: r.title, dueDate: r.dueDate ?? null, startsAt: r.startsAt ?? null, done: false };
});
const byId = new Map(ALL.map((r) => [r.id, r]));

/** NLU intent for a phrase -> search through the real CSV. */
function ask(phrase: string) {
  const intent = parse(phrase, null, NOW);
  if (intent.type !== "search") throw new Error(`not a search: ${phrase} -> ${intent.type}`);
  return searchRecords(ALL, intent, NOW);
}

describe("fixture", () => {
  it("has 1000 rows typed by the ADR-006 rule", () => {
    expect(ALL).toHaveLength(1000);
    expect(classifyCsvText("Встреча с Иваном по CRM")).toBe("meeting");
  });
});

describe("AC-10: search by word", () => {
  it("finds a task about договор in any word form (ids 2 and 5 are included)", () => {
    const { items } = ask("Я когда-то ставил задачу по договору, найди ее");
    const ids = items.map((r) => r.id);
    expect(ids).toContain(2);
    expect(ids).toContain(5);
    expect(items.every((r) => r.kind === "task")).toBe(true);
    expect(items.length).toBeLessThanOrEqual(5);
  });

  it("type word is a filter: «задачу про презентацию» returns only tasks with презентац", () => {
    const result = ask("Найди задачу про презентацию");
    expect(result.items.length).toBe(5);
    expect(result.total).toBeGreaterThan(5);
    for (const r of result.items) {
      expect(r.kind).toBe("task");
      expect(r.title.toLowerCase()).toContain("презентац");
    }
  });

  it("orders equal scores by earlier date, then id", () => {
    const { items } = ask("Найди задачу про презентацию");
    const times = items.map((r) => r.startsAt!.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });
});

describe("AC-11: tense and names", () => {
  it("«отчёты» finds id 7", () => {
    const { items } = ask("Найди задачу про отчёты");
    expect(items.map((r) => r.id)).toContain(7);
    expect(items[0]!.id).toBe(7);
  });

  it("«была встреча с Иваном» gives exactly 309, 429, 530", () => {
    const { items, total } = ask("Когда у меня была встреча с Иваном?");
    expect(items.map((r) => r.id).sort((a, b) => a - b)).toEqual([309, 429, 530]);
    expect(total).toBe(3);
  });

  it("«будет встреча с Иваном» gives only the future meeting 804", () => {
    expect(ask("Когда будет встреча с Иваном?").items.map((r) => r.id)).toEqual([804]);
  });
});

describe("AC-12: nothing found", () => {
  it.each(["Найди задачу про космический корабль", "Найди задачу про годовой план", "Найди задачу про билеты"])("%s", (phrase) => {
    expect(ask(phrase)).toEqual({ items: [], total: 0 });
  });
});

describe("scoring", () => {
  const rec = (id: number, title: string, kind: SearchableRecord["kind"] = "task"): SearchableRecord => ({
    id,
    kind,
    title,
    dueDate: "2026-11-01",
    startsAt: null,
  });

  it("exact stem beats prefix beats synonym beats fuzzy", () => {
    const records = [rec(4, "Проверить презентаци"), rec(3, "Подготовить слайды"), rec(2, "Подготовить презентацию"), rec(1, "Подготовить презинтацию")];
    const { items } = searchRecords(records, { terms: ["презентацию"] }, NOW);
    expect(items.map((r) => r.id)).toEqual([2, 4, 3, 1]);
  });

  it("empty terms list by filters", () => {
    const records = [rec(1, "a", "task"), rec(2, "b", "meeting")];
    expect(searchRecords(records, { terms: [], kind: "meeting" }, NOW).items.map((r) => r.id)).toEqual([2]);
  });

  it("undated records are excluded by a tense filter", () => {
    const records = [{ ...rec(1, "отчет"), dueDate: null }];
    expect(searchRecords(records, { terms: ["отчет"], tense: "future" }, NOW).total).toBe(0);
    expect(searchRecords(records, { terms: ["отчет"] }, NOW).total).toBe(1);
  });

  it("does not leak: only the passed records are searched", () => {
    expect(searchRecords([], { terms: ["отчет"] }, NOW)).toEqual({ items: [], total: 0 });
  });
});

describe("synonyms", () => {
  it.each([
    ["отчет", "доклад"],
    ["договор", "контракт"],
    ["созвон", "встреч"],
    ["презентац", "слайд"],
    ["бюджет", "смет"],
  ])("%s ~ %s", (a, b) => {
    expect(areSynonyms(stem(a), stem(b))).toBe(true);
  });

  it("«контракт» finds договор records", () => {
    const { items } = searchRecords(ALL, { terms: ["контракт"], kind: "task" }, NOW);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((r) => r.title.toLowerCase().includes("договор"))).toBe(true);
  });
});

describe("AC-17: resolveTargets", () => {
  it("«отчёт» has several candidates, at most 5", () => {
    const found = resolveTargets(ALL, { terms: ["отчет"] });
    expect(found.length).toBeGreaterThan(1);
    expect(found.length).toBeLessThanOrEqual(5);
  });

  it("a unique record resolves to one candidate", () => {
    const records = [...ALL, { id: 5000, kind: "task" as const, title: "Купить билеты", dueDate: null, startsAt: null }];
    expect(resolveTargets(records, { terms: ["билеты"] }).map((r) => r.id)).toEqual([5000]);
  });

  it("no candidates when nothing matches or no terms are given", () => {
    expect(resolveTargets(ALL, { terms: ["космический"] })).toEqual([]);
    expect(resolveTargets(ALL, { terms: [] })).toEqual([]);
  });

  it("applies the kind filter and ignores time", () => {
    const found = resolveTargets(ALL, { kind: "meeting", terms: ["иваном"] });
    expect(found.every((r) => r.kind === "meeting")).toBe(true);
    expect(byId.get(found[0]!.id)).toBeDefined();
  });
});

describe("T-010: verb aspect and paraphrases (QA probes)", () => {
  const rec = (id: number, kind: SearchableRecord["kind"], title: string): SearchableRecord => ({ id, kind, title, dueDate: null, startsAt: null });
  const POOL = [
    rec(9001, "task", "Позвонить стоматологу"),
    rec(9002, "task", "Подготовить презентацию"),
    rec(9003, "task", "Отправить отчет"),
    rec(9004, "meeting", "Созвон с клиентом"),
    rec(9005, "task", "Купить билеты"),
    rec(9006, "task", "Купить молоко"),
    rec(9007, "task", "Подписать договор"),
  ];
  const find = (phrase: string) => {
    const intent = parse(phrase, null, NOW);
    if (intent.type !== "search") throw new Error(`not a search: ${phrase} -> ${intent.type}`);
    return searchRecords(POOL, intent, NOW).items.map((r) => r.id);
  };

  it.each([
    ["Когда я должен был звонить стоматологу?", 9001],
    ["Когда я должен позвонить стоматологу?", 9001],
    ["Что там про стоматолога", 9001],
    ["Что у меня про договор?", 9007],
    ["Когда мне нужно готовить презентацию?", 9002],
    ["Когда я должен был отправлять отчет?", 9003],
    ["Когда я созванивался с клиентом?", 9004],
  ])("%s", (phrase, id) => {
    expect(find(phrase)[0]).toBe(id);
  });

  it("aspect pairs match: звонить/позвонить/созвониться, готовить/подготовить", () => {
    const one = (term: string, title: string) => searchRecords([rec(1, "task", title)], { terms: [term] }, NOW).total;
    expect(one("звонить", "Позвонить Ивану")).toBe(1);
    expect(one("позвонить", "Звонить Ивану")).toBe(1);
    expect(one("созвониться", "Звонить Ивану")).toBe(1);
    expect(one("готовить", "Подготовить отчет")).toBe(1);
    expect(one("отправлять", "Отправить отчет")).toBe(1);
    expect(one("сделать", "Делать зарядку")).toBe(1);
    expect(one("звонить", "Договор с поставщиком")).toBe(0);
  });

  it("resolves «я купил билеты» to the record «Купить билеты»", () => {
    const intent = parse("Я купил билеты", null, NOW);
    if (intent.type !== "complete" || !("terms" in intent.target)) throw new Error("not complete");
    expect(resolveTargets(POOL, intent.target).map((r) => r.id)).toEqual([9005]);
  });

  it("«найди все встречи с Иваном» does not search for «все»", () => {
    const intent = parse("Найди все встречи с Иваном", null, NOW);
    if (intent.type !== "search") throw new Error("not a search");
    const withIvan = [rec(1, "meeting", "Встреча с Иваном"), rec(2, "meeting", "Встреча с Петром")];
    expect(searchRecords(withIvan, intent, NOW).items.map((r) => r.id)).toEqual([1]);
  });
});

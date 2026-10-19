import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { chat, norm, recordsPanel, resetDialog, signIn, titles, type RecordDto } from "./helpers";

// Tests on the seeded user «Демо» only read: they never create, change or delete its records.
test.beforeEach(async ({ request }) => {
  await signIn(request, "Демо");
  await resetDialog(request);
});

const hasWord = (items: RecordDto[], re: RegExp) => items.every((i) => re.test(i.title));

test("AC-10 (a) search 'task about the contract': at most 5, only tasks with 'договор', includes ids 2 and 5", async ({ request }) => {
  const reply = await chat(request, "Я когда-то ставил задачу по договору, найди ее");
  const { items } = reply.panel;
  expect(items.length).toBeGreaterThan(0);
  expect(items.length).toBeLessThanOrEqual(5);
  expect(items.every((i) => i.kind === "task")).toBe(true);
  expect(hasWord(items, /договор/i)).toBe(true);
  const ids = items.map((i) => i.id);
  expect(ids).toContain(2);
  expect(ids).toContain(5);
});

test("AC-10 (b) search 'task about the presentation': only tasks with 'презентац', no reminders or meetings", async ({ request }) => {
  const reply = await chat(request, "Найди задачу про презентацию");
  const { items } = reply.panel;
  expect(items.length).toBeGreaterThan(0);
  expect(items.length).toBeLessThanOrEqual(5);
  expect(items.every((i) => i.kind === "task")).toBe(true);
  expect(hasWord(items, /презентац/i)).toBe(true);
  const ids = items.map((i) => i.id);
  expect(ids).not.toContain(38);
  expect(ids).not.toContain(105);
});

test("AC-11 (a) a different word form ('отчёты') finds tasks with 'отчёт', including id 7", async ({ request }) => {
  const reply = await chat(request, "Найди задачу про отчёты");
  const { items } = reply.panel;
  expect(items.length).toBeLessThanOrEqual(5);
  expect(items.every((i) => i.kind === "task")).toBe(true);
  expect(hasWord(items, /отч[её]т/i)).toBe(true);
  expect(items.map((i) => i.id)).toContain(7);
});

test("AC-11 (b) 'when was the meeting with Ivan' lists exactly the past meetings 309, 429, 530", async ({ request }) => {
  const reply = await chat(request, "Когда у меня была встреча с Иваном?");
  expect(reply.panel.items.map((i) => i.id).sort((a, b) => a - b)).toEqual([309, 429, 530]);
  expect(reply.panel.items.every((i) => i.kind === "meeting")).toBe(true);
  const text = reply.messages[1].text;
  expect(text).toContain("4 апреля 2025");
  expect(text).toContain("27 сентября 2025");
  expect(text).toContain("5 марта 2026");
  expect(text).not.toContain("2027");
  expect(text).not.toContain("Отправить итоги встречи");
});

test("AC-12 nothing found: says so and suggests to refine the query", async ({ request }) => {
  const reply = await chat(request, "Найди задачу про космический корабль");
  expect(reply.panel.items).toHaveLength(0);
  expect(norm(reply.messages[1].text)).toContain("ничего не нашел");
  expect(norm(reply.messages[1].text)).toContain("уточн");
});

// ---- AC-22: the CSV history of «Демо» ----

type CsvRow = { id: number; date: string; time: string; text: string };
const csv = readFileSync(path.join(process.cwd(), "docs/source/voice_assistant_events.csv"), "utf8");
const rows: CsvRow[] = csv
  .split(/\r?\n/)
  .slice(1)
  .filter((line) => line.trim() !== "")
  .map((line) => {
    const [id, date, time, ...rest] = line.split(",");
    return { id: Number(id), date, time, text: rest.join(",") };
  });

function kindOf(text: string): RecordDto["kind"] {
  const t = text.toLowerCase();
  if (/^(встреч|созвон|демо)/.test(t) || /планер?к|планёрк/.test(t)) return "meeting";
  if (t.startsWith("напомн")) return "reminder";
  return "task";
}

const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const human = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};

test("AC-22 'What was on 26 January 2024?' returns exactly ids 14, 15, 16 in time order", async ({ request }) => {
  const reply = await chat(request, "Что было 26 января 2024?");
  expect(reply.panel.items.map((i) => i.id)).toEqual([14, 15, 16]);
  expect(reply.panel.items.map((i) => i.kind)).toEqual(["meeting", "task", "meeting"]);
  expect(reply.panel.items.map((i) => i.time)).toEqual(["11:00", "12:45", "17:30"]);
  const text = norm(reply.messages[1].text);
  expect(text).toContain("планерку по договору");
  const order = ["11:00", "12:45", "17:30"].map((t) => reply.messages[1].text.indexOf(t));
  expect(order.every((i) => i >= 0)).toBe(true);
  expect([...order].sort((a, b) => a - b)).toEqual(order);
});

test("AC-22 the CSV is imported completely, once, with types by the rule (spot checks across the whole range)", async ({ request }) => {
  expect(rows).toHaveLength(1000);
  const sampleDates = new Set([rows[0], rows[250], rows[500], rows[750], rows[999], rows.find((r) => r.id === 804)!].map((r) => r.date));
  for (const date of sampleDates) {
    const expected = rows
      .filter((r) => r.date === date)
      .sort((a, b) => (a.time === b.time ? a.id - b.id : a.time < b.time ? -1 : 1));
    const reply = await chat(request, `Что у меня ${human(date)}?`);
    expect(reply.panel.items.map((i) => i.id), date).toEqual(expected.map((r) => r.id));
    expect(reply.panel.items.map((i) => i.kind), date).toEqual(expected.map((r) => kindOf(r.text)));
    expect(reply.panel.items.map((i) => i.time), date).toEqual(expected.map((r) => r.time));
    expect(reply.panel.items.every((i) => !i.done)).toBe(true);
    expect(titles(reply.panel.items), date).toEqual(expected.map((r) => norm(r.text)));
  }
});

test("AC-22 the type rule: 'итоги встречи' is a task, 'Встреча с Иваном по CRM' is a meeting", async ({ request }) => {
  const reply = await chat(request, "Что у меня 27 мая 2024?");
  const row94 = reply.panel.items.find((i) => i.id === 94);
  expect(row94).toMatchObject({ kind: "task" });
  const meetings = await chat(request, "Когда у меня была встреча с Иваном?");
  expect(meetings.panel.items.find((i) => i.id === 309)).toMatchObject({ kind: "meeting", date: "2025-04-04", time: "18:00" });
});

test("AC-22 another user does not get the demo history; «Демо» still has it", async ({ request, playwright, baseURL }) => {
  const other = await playwright.request.newContext({ baseURL });
  await signIn(other, `Гость-${Date.now().toString(36)}`);
  const empty = await chat(other, "Когда у меня была встреча с Иваном?");
  expect(empty.panel.items).toHaveLength(0);
  const own = await recordsPanel(request);
  expect(own.total).toBeGreaterThan(0);
  await other.dispose();
});

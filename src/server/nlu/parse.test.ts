import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { APP_ZONE } from "@/server/clock";
import { parse } from "./parse";
import type { Expect, Intent } from "./types";

// Monday, the reference moment of the brief.
const NOW = DateTime.fromISO("2026-10-19T10:00:00", { zone: APP_ZONE });

type Row = [phrase: string, expected: Intent];

function table(rows: Row[], expectKind: Expect = null, now: DateTime = NOW): void {
  it.each(rows)("%s", (phrase, expected) => {
    expect(parse(phrase, expectKind, now)).toEqual(expected);
  });
}

const focus = { ref: "focus" } as const;

describe("create: AC-01..AC-06", () => {
  table([
    // AC-01
    [
      "Напомни мне завтра в 10 утра позвонить Ивану",
      { type: "create", kind: "reminder", title: "позвонить Ивану", date: "2026-10-20", time: "10:00", hasDeadline: false },
    ],
    // AC-02
    ["В пятницу нужно отправить отчет", { type: "create", kind: "task", title: "отправить отчет", date: "2026-10-23", hasDeadline: false }],
    // AC-03
    [
      "Поставь задачу купить билеты до конца недели",
      { type: "create", kind: "task", title: "купить билеты", date: "2026-10-25", hasDeadline: true },
    ],
    // AC-04
    [
      "Добавь встречу с командой завтра в 15:00",
      { type: "create", kind: "meeting", title: "встреча с командой", date: "2026-10-20", time: "15:00", hasDeadline: false },
    ],
    [
      "В четверг в 11 у меня встреча с дизайнером",
      { type: "create", kind: "meeting", title: "встреча с дизайнером", date: "2026-10-22", time: "11:00", hasDeadline: false },
    ],
    // AC-05 (first half: the time is missing, the parser must not guess it)
    ["Поставь встречу с Иваном завтра", { type: "create", kind: "meeting", title: "встреча с Иваном", date: "2026-10-20", hasDeadline: false }],
    // AC-06
    [
      "Напомни через два часа выпить воды",
      { type: "create", kind: "reminder", title: "выпить воды", date: "2026-10-19", time: "12:00", hasDeadline: false },
    ],
    ["Поставь задачу позвонить в банк послезавтра", { type: "create", kind: "task", title: "позвонить в банк", date: "2026-10-21", hasDeadline: false }],
  ]);
});

describe("create: paraphrases and slots", () => {
  table([
    ["Напомни завтра в 9 утра купить молоко", { type: "create", kind: "reminder", title: "купить молоко", date: "2026-10-20", time: "09:00", hasDeadline: false }],
    ["Напомни в 15 позвонить маме", { type: "create", kind: "reminder", title: "позвонить маме", date: "2026-10-19", time: "15:00", hasDeadline: false }],
    ["Напомни в 7 вечера выпить чаю", { type: "create", kind: "reminder", title: "выпить чаю", date: "2026-10-19", time: "19:00", hasDeadline: false }],
    ["Напомни в 9 позвонить маме", { type: "create", kind: "reminder", title: "позвонить маме", date: "2026-10-20", time: "09:00", hasDeadline: false }],
    ["Напомни в 3 дня забрать посылку", { type: "create", kind: "reminder", title: "забрать посылку", date: "2026-10-19", time: "15:00", hasDeadline: false }],
    ["Напомни через полчаса проверить почту", { type: "create", kind: "reminder", title: "проверить почту", date: "2026-10-19", time: "10:30", hasDeadline: false }],
    ["Напомни через 15 минут выключить плиту", { type: "create", kind: "reminder", title: "выключить плиту", date: "2026-10-19", time: "10:15", hasDeadline: false }],
    ["Напомни через час позвонить в банк", { type: "create", kind: "reminder", title: "позвонить в банк", date: "2026-10-19", time: "11:00", hasDeadline: false }],
    ["Напомни завтра вечером полить цветы", { type: "create", kind: "reminder", title: "полить цветы", date: "2026-10-20", time: "19:00", hasDeadline: false }],
    ["Напомни завтра позвонить врачу", { type: "create", kind: "reminder", title: "позвонить врачу", date: "2026-10-20", hasDeadline: false }],
    ["Поставь задачу сдать отчет в понедельник", { type: "create", kind: "task", title: "сдать отчет", date: "2026-10-26", hasDeadline: false }],
    ["Нужно отправить договор до пятницы", { type: "create", kind: "task", title: "отправить договор", date: "2026-10-23", hasDeadline: true }],
    ["Поставь задачу купить хлеб 25 октября", { type: "create", kind: "task", title: "купить хлеб", date: "2026-10-25", hasDeadline: false }],
    ["Поставь задачу купить сахар сегодня", { type: "create", kind: "task", title: "купить сахар", date: "2026-10-19", hasDeadline: false }],
    ["Добавь задачу купить подарок на 30 октября", { type: "create", kind: "task", title: "купить подарок", date: "2026-10-30", hasDeadline: false }],
    ["Запиши: подготовить годовой план", { type: "create", kind: "task", title: "подготовить годовой план", hasDeadline: false }],
    ["Поставь задачу", { type: "create", kind: "task", hasDeadline: false }],
    ["Поставь встречу", { type: "create", kind: "meeting", title: "встреча", hasDeadline: false }],
    ["Напомни завтра в 10", { type: "create", kind: "reminder", date: "2026-10-20", time: "10:00", hasDeadline: false }],
    ["Добавь встречу с Иваном 25 октября в 14:00", { type: "create", kind: "meeting", title: "встреча с Иваном", date: "2026-10-25", time: "14:00", hasDeadline: false }],
    ["Назначь созвон с клиентом послезавтра в 12", { type: "create", kind: "meeting", title: "созвон с клиентом", date: "2026-10-21", time: "12:00", hasDeadline: false }],
    ["Запланируй планерку на завтра в 11", { type: "create", kind: "meeting", title: "планерка", date: "2026-10-20", time: "11:00", hasDeadline: false }],
    ["Добавь встречу с клиентом завтра в 15:30", { type: "create", kind: "meeting", title: "встреча с клиентом", date: "2026-10-20", time: "15:30", hasDeadline: false }],
    ["Добавь встречу с дизайнером сегодня в 11:00", { type: "create", kind: "meeting", title: "встреча с дизайнером", date: "2026-10-19", time: "11:00", hasDeadline: false }],
    ["Поставь задачу подготовить отчёт для банка", { type: "create", kind: "task", title: "подготовить отчёт для банка", hasDeadline: false }],
    ["Поставь задачу подготовить годовой план завтра", { type: "create", kind: "task", title: "подготовить годовой план", date: "2026-10-20", hasDeadline: false }],
    ["Добавь встречу с Петром 20 октября в 15:00", { type: "create", kind: "meeting", title: "встреча с Петром", date: "2026-10-20", time: "15:00", hasDeadline: false }],
    ["Поставь встречу с Олегом завтра в 3 часа дня", { type: "create", kind: "meeting", title: "встреча с Олегом", date: "2026-10-20", time: "15:00", hasDeadline: false }],
  ]);

  it("keeps the original case of the title", () => {
    const intent = parse("Поставь задачу Позвонить в ООО Ромашка", null, NOW);
    expect(intent).toMatchObject({ type: "create", kind: "task", title: "Позвонить в ООО Ромашка" });
  });
});

describe("list: AC-06..AC-09, AC-22", () => {
  const today = { from: "2026-10-19", to: "2026-10-20", label: "сегодня" };
  table([
    ["Что у меня сегодня?", { type: "list", period: today, exists: false }],
    ["Какие планы на сегодня?", { type: "list", period: today, exists: false }],
    ["Покажи мои встречи на сегодня", { type: "list", period: today, kind: "meeting", exists: false }],
    ["Какие задачи у меня на завтра?", { type: "list", period: { from: "2026-10-20", to: "2026-10-21", label: "завтра" }, kind: "task", exists: false }],
    ["Что запланировано на эту неделю?", { type: "list", period: { from: "2026-10-19", to: "2026-10-26", label: "эту неделю" }, exists: false }],
    ["Что у меня на этой неделе?", { type: "list", period: { from: "2026-10-19", to: "2026-10-26", label: "эту неделю" }, exists: false }],
    ["Что у меня на следующей неделе?", { type: "list", period: { from: "2026-10-26", to: "2026-11-02", label: "следующую неделю" }, exists: false }],
    ["Есть ли у меня встречи сегодня?", { type: "list", period: today, kind: "meeting", exists: true }],
    ["Что у меня завтра?", { type: "list", period: { from: "2026-10-20", to: "2026-10-21", label: "завтра" }, exists: false }],
    ["Что у меня послезавтра?", { type: "list", period: { from: "2026-10-21", to: "2026-10-22", label: "послезавтра" }, exists: false }],
    ["Что у меня в пятницу?", { type: "list", period: { from: "2026-10-23", to: "2026-10-24", label: "23 октября" }, exists: false }],
    ["Что у меня на выходных?", { type: "list", period: { from: "2026-10-24", to: "2026-10-26", label: "выходные" }, exists: false }],
    ["Покажи расписание", { type: "list", exists: false }],
    ["Что у меня?", { type: "list", exists: false }],
    // AC-22
    ["Что было 26 января 2024?", { type: "list", period: { from: "2024-01-26", to: "2024-01-27", label: "26 января 2024" }, exists: false }],
    ["Что у меня 27 мая 2024?", { type: "list", period: { from: "2024-05-27", to: "2024-05-28", label: "27 мая 2024" }, exists: false }],
    ["Что у меня 25 октября?", { type: "list", period: { from: "2026-10-25", to: "2026-10-26", label: "25 октября" }, exists: false }],
  ]);
});

describe("search: AC-10..AC-12", () => {
  table([
    ["Я когда-то ставил задачу по договору, найди ее", { type: "search", terms: ["договору"], kind: "task", tense: "past" }],
    ["Найди задачу про презентацию", { type: "search", terms: ["презентацию"], kind: "task" }],
    ["Найди задачу про отчёты", { type: "search", terms: ["отчеты"], kind: "task" }],
    ["Когда у меня была встреча с Иваном?", { type: "search", terms: ["иваном"], kind: "meeting", tense: "past" }],
    ["Найди задачу про космический корабль", { type: "search", terms: ["космический", "корабль"], kind: "task" }],
    ["Найди задачу про годовой план", { type: "search", terms: ["годовой", "план"], kind: "task" }],
    ["Найди задачу про билеты", { type: "search", terms: ["билеты"], kind: "task" }],
    ["Когда будет встреча с Иваном?", { type: "search", terms: ["иваном"], kind: "meeting", tense: "future" }],
    ["Поищи напоминание про доклад", { type: "search", terms: ["доклад"], kind: "reminder" }],
    ["Найди встречу по CRM", { type: "search", terms: ["crm"], kind: "meeting" }],
    ["Найди созвон с Партнёром", { type: "search", terms: ["созвон", "партнером"], kind: "meeting" }],
    ["Найди встречи", { type: "search", terms: [], kind: "meeting" }],
  ]);
});

describe("update / complete / delete: AC-15..AC-17", () => {
  table([
    ["А перенеси её на завтра", { type: "update", target: focus, change: { date: "2026-10-20" } }],
    ["перенеси её на завтра", { type: "update", target: focus, change: { date: "2026-10-20" } }],
    ["Перенеси встречу с дизайнером на 11:00", { type: "update", target: { kind: "meeting", terms: ["дизайнером"] }, change: { time: "11:00" } }],
    ["Перенеси на завтра", { type: "update", target: { terms: [] }, change: { date: "2026-10-20" } }],
    ["Перенеси эту встречу на пятницу в 16:00", { type: "update", target: focus, change: { date: "2026-10-23", time: "16:00" } }],
    ["Удали задачу купить билеты", { type: "delete", target: { kind: "task", terms: ["купить", "билеты"] } }],
    ["Удали задачу про отчёт", { type: "delete", target: { kind: "task", terms: ["отчет"] } }],
    ["Удали её", { type: "delete", target: focus }],
    ["Удали эту задачу", { type: "delete", target: focus }],
    ["Удали задачу", { type: "delete", target: { kind: "task", terms: [] } }],
    ["Отметь задачу купить билеты выполненной", { type: "complete", target: { kind: "task", terms: ["купить", "билеты"] } }],
    ["Отметь её выполненной", { type: "complete", target: focus }],
    ["Отметь задачу про отчет как выполненную", { type: "complete", target: { kind: "task", terms: ["отчет"] } }],
  ]);
});

describe("answers while the dialog waits (expect)", () => {
  describe("yes_no", () => {
    table(
      [
        ["да", { type: "confirm", yes: true }],
        ["Да, конечно", { type: "confirm", yes: true }],
        ["Всё равно ставь", { type: "confirm", yes: true }],
        ["нет", { type: "confirm", yes: false }],
        ["не надо", { type: "confirm", yes: false }],
        ["Нет, не ставь", { type: "confirm", yes: false }],
        ["отмена", { type: "cancel" }],
        ["Добавь встречу с клиентом завтра в 15:00", { type: "create", kind: "meeting", title: "встреча с клиентом", date: "2026-10-20", time: "15:00", hasDeadline: false }],
      ],
      "yes_no",
    );
  });
  describe("choice", () => {
    table(
      [
        ["2", { type: "choose", index: 2 }],
        ["вторую", { type: "choose", index: 2 }],
        ["номер два", { type: "choose", index: 2 }],
        ["Первая", { type: "choose", index: 1 }],
        ["нет", { type: "cancel" }],
        ["стоп", { type: "cancel" }],
        ["Удали задачу про отчёт", { type: "delete", target: { kind: "task", terms: ["отчет"] } }],
      ],
      "choice",
    );
  });
  describe("slot", () => {
    table(
      [
        ["в 14:30", { type: "slot", time: "14:30" }],
        ["завтра", { type: "slot", date: "2026-10-20" }],
        ["завтра в 15", { type: "slot", date: "2026-10-20", time: "15:00" }],
        ["в 3 дня", { type: "slot", time: "15:00" }],
        ["15", { type: "slot", time: "15:00" }],
        ["в четверг", { type: "slot", date: "2026-10-22" }],
        ["купить хлеб", { type: "slot", title: "купить хлеб" }],
        ["купить хлеб завтра", { type: "slot", title: "купить хлеб", date: "2026-10-20" }],
        ["отмена", { type: "cancel" }],
        ["не надо", { type: "cancel" }],
        ["Что у меня сегодня?", { type: "list", period: { from: "2026-10-19", to: "2026-10-20", label: "сегодня" }, exists: false }],
        ["Поставь встречу с Иваном завтра в 14:30", { type: "create", kind: "meeting", title: "встреча с Иваном", date: "2026-10-20", time: "14:30", hasDeadline: false }],
      ],
      "slot",
    );
  });
  describe("target", () => {
    table(
      [
        ["про отчёт", { type: "target", target: { terms: ["отчет"] } }],
        ["задачу про отчёт", { type: "target", target: { kind: "task", terms: ["отчет"] } }],
        ["встречу с дизайнером", { type: "target", target: { kind: "meeting", terms: ["дизайнером"] } }],
        ["отмена", { type: "cancel" }],
      ],
      "target",
    );
  });
});

describe("without a waiting question (idle)", () => {
  table([
    ["да", { type: "confirm", yes: true }],
    ["нет", { type: "confirm", yes: false }],
    ["2", { type: "choose", index: 2 }],
    ["в 14:30", { type: "slot", time: "14:30" }],
    ["отмена", { type: "cancel" }],
  ]);
});

describe("unknown: AC-13", () => {
  table([
    ["Как дела на Марсе?", { type: "unknown" }],
    ["привет", { type: "unknown" }],
    ["Расскажи анекдот", { type: "unknown" }],
    ["", { type: "unknown" }],
    ["   ?!  ", { type: "unknown" }],
  ]);
});

describe("false friends", () => {
  table([
    ["Какая погода завтра?", { type: "unknown" }],
    ["Нужно убрать мусор", { type: "create", kind: "task", title: "убрать мусор", hasDeadline: false }],
    ["Поставь задачу убрать квартиру завтра", { type: "create", kind: "task", title: "убрать квартиру", date: "2026-10-20", hasDeadline: false }],
    ["Встреча с Иваном завтра в 12", { type: "create", kind: "meeting", title: "встреча с Иваном", date: "2026-10-20", time: "12:00", hasDeadline: false }],
    ["Напомни в десять тридцать выпить воды", { type: "create", kind: "reminder", title: "выпить воды", date: "2026-10-19", time: "10:30", hasDeadline: false }],
    ["Что нужно сделать завтра?", { type: "list", period: { from: "2026-10-20", to: "2026-10-21", label: "завтра" }, exists: false }],
  ]);
});

describe("date boundaries", () => {
  it("rolls over the year for «послезавтра» on 30 December", () => {
    const now = DateTime.fromISO("2026-12-30T10:00:00", { zone: APP_ZONE });
    expect(parse("Поставь задачу позвонить в банк послезавтра", null, now)).toMatchObject({ date: "2027-01-01" });
  });
  it("rolls over midnight for «через два часа» at 23:30", () => {
    const now = DateTime.fromISO("2026-10-19T23:30:00", { zone: APP_ZONE });
    expect(parse("Напомни через два часа выпить воды", null, now)).toMatchObject({ date: "2026-10-20", time: "01:30" });
  });
  it("«до конца недели» on a Sunday is that Sunday", () => {
    const now = DateTime.fromISO("2026-10-25T10:00:00", { zone: APP_ZONE });
    expect(parse("Поставь задачу купить билеты до конца недели", null, now)).toMatchObject({ date: "2026-10-25", hasDeadline: true });
  });
  it("a date without a year is the nearest future one", () => {
    expect(parse("Поставь задачу купить хлеб 26 января", null, NOW)).toMatchObject({ date: "2027-01-26" });
  });
  it("is deterministic for the same input", () => {
    const a = parse("Напомни завтра в 10 позвонить Ивану", null, NOW);
    const b = parse("Напомни завтра в 10 позвонить Ивану", null, NOW);
    expect(a).toEqual(b);
  });
});

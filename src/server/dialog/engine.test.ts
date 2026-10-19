import { DateTime } from "luxon";
import { beforeEach, describe, expect, test } from "vitest";
import { setupTestDb } from "@/db/test-db";
import { getOrCreateUser } from "@/db/users";
import { createRecord } from "@/server/services/records";
import { handleChat, loadDialog, resetDialog } from "./engine";

const now = DateTime.fromISO("2026-10-19T10:00:00", { zone: "Europe/Moscow" });
let db: Awaited<ReturnType<typeof setupTestDb>>;
let anna: number;
let boris: number;

beforeEach(async () => {
  db = await setupTestDb();
  anna = (await getOrCreateUser(db, "Анна", now.toJSDate())).id;
  boris = (await getOrCreateUser(db, "Борис", now.toJSDate())).id;
});

const say = (text: string, userId = anna) => handleChat(db, userId, text, now);
const reply = async (text: string, userId = anna) => (await say(text, userId)).messages[1].text;

describe("create (AC-01..AC-06)", () => {
  test("reminder is saved and the reply names the day, time and text", async () => {
    const res = await say("Напомни мне завтра в 10 утра позвонить Ивану");
    expect(res.messages[1].text).toBe("Напомню 20 октября в 10:00: позвонить Ивану");
    expect(res.panel.items).toMatchObject([{ kind: "reminder", date: "2026-10-20", time: "10:00" }]);
  });

  test("task without time is saved at once, no question", async () => {
    const res = await say("В пятницу нужно отправить отчет");
    expect(res.awaiting).toBeNull();
    expect(res.messages[1].text).not.toContain("?");
    expect(res.panel.items[0]).toMatchObject({ kind: "task", date: "2026-10-23", time: null });
  });

  test("deadline task names Sunday", async () => {
    expect(await reply("Поставь задачу купить билеты до конца недели")).toContain("со сроком до 25 октября");
  });

  test("meeting without a time asks, saves nothing, then saves after the answer", async () => {
    const ask = await say("Поставь встречу с Иваном завтра");
    expect(ask.messages[1].text).toBe("На какое время поставить встречу?");
    expect(ask.awaiting).toBe("slot");
    expect(ask.panel.items).toHaveLength(0);
    const done = await say("в 14:30");
    expect(done.awaiting).toBeNull();
    expect(done.messages[1].text).toContain("14:30");
    expect(done.panel.items).toMatchObject([{ kind: "meeting", date: "2026-10-20", time: "14:30" }]);
  });

  test("relative time: in two hours", async () => {
    const res = await say("Напомни через два часа выпить воды");
    expect(res.panel.items[0]).toMatchObject({ date: "2026-10-19", time: "12:00" });
  });
});

describe("conflicts (AC-14)", () => {
  beforeEach(async () => {
    await say("Добавь встречу с командой завтра в 15:00");
  });

  test("same time asks, «да» saves", async () => {
    const ask = await say("Добавь встречу с клиентом завтра в 15:00");
    expect(ask.awaiting).toBe("yes_no");
    expect(ask.messages[1].text).toContain("встреча с командой");
    expect(ask.messages[1].text).toContain("Всё равно поставить?");
    expect(ask.panel.items).toHaveLength(1);
    const yes = await say("да");
    expect(yes.panel.items).toHaveLength(2);
  });

  test("«нет» saves nothing", async () => {
    await say("Добавь встречу с клиентом завтра в 15:30");
    const no = await say("нет");
    expect(no.messages[1].text).toBe("Хорошо, не ставлю.");
    expect(no.panel.items).toHaveLength(1);
  });

  test("back-to-back at 16:00 is no conflict", async () => {
    const res = await say("Добавь встречу с клиентом завтра в 16:00");
    expect(res.awaiting).toBeNull();
    expect(res.panel.items).toHaveLength(2);
  });
});

describe("lists (AC-07..AC-09)", () => {
  test("empty period", async () => {
    expect(await reply("Что у меня сегодня?")).toBe("На сегодня ничего не запланировано");
    expect(await reply("Что у меня на следующей неделе?")).toBe("На следующую неделю ничего не запланировано");
  });

  test("reply and panel carry the same records", async () => {
    await say("Добавь встречу с дизайнером сегодня в 11:00");
    await say("Поставь задачу отправить отчет сегодня");
    await say("Поставь задачу забрать посылку завтра");
    const res = await say("Какие планы на сегодня?");
    expect(res.panel.items.map((i) => i.title)).toEqual(["отправить отчет", "встреча с дизайнером"]);
    expect(res.messages[1].text).toBe("На сегодня: 1. отправить отчет; 2. 11:00 встреча с дизайнером");
    expect(res.messages[1].items).toHaveLength(2);
  });

  test("exists answers yes or no", async () => {
    expect(await reply("Есть ли у меня встречи сегодня?")).toBe("Нет, на сегодня встреч нет");
    await say("Добавь встречу с дизайнером сегодня в 16:00");
    expect(await reply("Есть ли у меня встречи сегодня?")).toMatch(/^Да, на сегодня 1 встреча: /);
  });
});

describe("unknown (AC-13)", () => {
  test("gives examples and saves nothing", async () => {
    const res = await say("Как дела на Марсе?");
    expect(res.messages[1].text).toContain("Не понял запрос");
    expect(res.messages[1].text.match(/«[^»]+»/g)).toHaveLength(3);
    expect(res.panel.items).toHaveLength(0);
  });
});

describe("complete, delete, choose, move (AC-15..AC-17)", () => {
  test("complete then delete with confirmation", async () => {
    await say("Поставь задачу купить билеты до конца недели");
    const done = await say("Отметь задачу купить билеты выполненной");
    expect(done.messages[1].text).toBe("Отметил задачу «купить билеты» выполненной");
    expect(done.panel.items[0]!.done).toBe(true);
    const ask = await say("Удали задачу купить билеты");
    expect(ask.messages[1].text).toBe("Удалить задачу «купить билеты»?");
    expect(ask.awaiting).toBe("yes_no");
    expect(ask.panel.items).toHaveLength(1);
    const yes = await say("да");
    expect(yes.panel.items).toHaveLength(0);
    expect((await say("Найди задачу про билеты")).panel.items).toHaveLength(0);
  });

  test("«нет» keeps the record", async () => {
    await say("Поставь задачу купить билеты до конца недели");
    await say("Удали задачу купить билеты");
    const no = await say("нет");
    expect(no.awaiting).toBeNull();
    expect(no.panel.items).toHaveLength(1);
  });

  test("several matches list the candidates; the chosen one is confirmed then deleted", async () => {
    await say("Поставь задачу подготовить отчёт для банка");
    await say("Поставь задачу подготовить отчёт для клиента");
    const list = await say("Удали задачу про отчёт");
    expect(list.messages[1].text).toBe(
      "Нашёл несколько задач: 1. подготовить отчёт для банка; 2. подготовить отчёт для клиента. Какую удалить?",
    );
    expect(list.awaiting).toBe("choice");
    const bad = await say("5");
    expect(bad.awaiting).toBe("choice");
    expect(bad.messages[1].text).toContain("Введите номер от 1 до 2");
    const confirm = await say("2");
    expect(confirm.messages[1].text).toBe("Удалить задачу «подготовить отчёт для клиента»?");
    const yes = await say("да");
    expect(yes.panel.items.map((i) => i.title)).toEqual(["подготовить отчёт для банка"]);
  });

  test("«перенеси её на завтра» moves the last record and keeps its time", async () => {
    await say("В четверг в 11 у меня встреча с дизайнером");
    const res = await say("А перенеси её на завтра");
    expect(res.messages[1].text).toBe("Перенёс встречу «встреча с дизайнером» на 20 октября в 11:00");
    expect(res.panel.items).toMatchObject([{ date: "2026-10-20", time: "11:00" }]);
  });

  test("without context it asks which record, and the next answer finds it", async () => {
    await say("Поставь задачу купить хлеб послезавтра");
    await resetDialog(db, anna);
    const ask = await say("перенеси её на завтра");
    expect(ask.messages[1].text).toBe("Какую запись перенести?");
    expect(ask.awaiting).toBe("target");
    const res = await say("задачу про хлеб");
    expect(res.messages[1].text).toContain("Перенёс задачу «купить хлеб» на 20 октября");
    expect(res.panel.items[0]).toMatchObject({ date: "2026-10-20" });
  });

  test("moving a meeting onto another meeting asks first", async () => {
    await say("Добавь встречу с командой завтра в 15:00");
    await say("Добавь встречу с клиентом завтра в 11:00");
    const ask = await say("перенеси её на 15:00");
    expect(ask.awaiting).toBe("yes_no");
    expect(ask.messages[1].text).toContain("Всё равно перенести?");
    const yes = await say("да");
    expect(yes.messages[1].text).toContain("Перенёс встречу «встреча с клиентом»");
  });

  test("cancel drops the question", async () => {
    await say("Поставь встречу с Иваном завтра");
    const res = await say("отмена");
    expect(res.messages[1].text).toBe("Хорошо, отменил.");
    expect(res.awaiting).toBeNull();
  });

  test("a new command replaces a pending question", async () => {
    await say("Поставь встречу с Иваном завтра");
    const res = await say("Что у меня сегодня?");
    expect(res.messages[1].text).toBe("На сегодня ничего не запланировано");
    expect(res.awaiting).toBeNull();
  });

  test("«да» with nothing pending", async () => {
    expect(await reply("да")).toBe("Сейчас нечего подтверждать. Что сделать?");
  });
});

describe("search (AC-10..AC-12)", () => {
  test("finds by word form and says so when nothing matches", async () => {
    await createRecord(db, anna, { kind: "task", title: "Подготовить отчёт", date: "2025-04-04" }, now);
    const found = await say("Найди задачу про отчёты");
    expect(found.messages[1].text).toBe("Нашёл 1 задачу: 1. Подготовить отчёт — 4 апреля 2025");
    expect(found.panel.title).toBe("Поиск: отчеты");
    await createRecord(db, anna, { kind: "task", title: "Отчёт за квартал", date: "2026-03-05", time: "15:45" }, now);
    expect((await reply("Найди задачу про отчёт")).replace(/^.*?:/, "")).toContain("5 марта 2026, 15:45");
    const none = await say("Найди задачу про космический корабль");
    expect(none.messages[1].text).toContain("Ничего не нашёл");
    expect(none.messages[1].text).toContain("уточн");
    expect(none.panel.items).toHaveLength(0);
  });
});

describe("isolation, history, state", () => {
  test("another user sees nothing and cannot touch the records", async () => {
    await say("Поставь задачу купить хлеб");
    expect((await say("Найди задачу про хлеб", boris)).panel.items).toHaveLength(0);
    expect(await reply("Удали задачу купить хлеб", boris)).toContain("Не нашёл");
    expect((await loadDialog(db, anna, now)).panel.total).toBe(1);
    expect((await loadDialog(db, boris, now)).panel.total).toBe(0);
  });

  test("history is stored, reset erases it and the pending question", async () => {
    await say("Поставь встречу с Иваном завтра");
    const before = await loadDialog(db, anna, now);
    expect(before.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(before.awaiting).toBe("slot");
    await resetDialog(db, anna);
    const after = await loadDialog(db, anna, now);
    expect(after.messages).toHaveLength(0);
    expect(after.awaiting).toBeNull();
  });

  test("a damaged stored state falls back to idle", async () => {
    const { setDialogState } = await import("@/db/dialog");
    await setDialogState(db, anna, { stateJson: '{"kind":"await_delete"}', focusRecordId: null }, now.toJSDate());
    expect(await reply("Что у меня сегодня?")).toBe("На сегодня ничего не запланировано");
  });
});

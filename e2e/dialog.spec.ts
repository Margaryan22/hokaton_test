import { expect, test } from "@playwright/test";
import { chat, feed, norm, openAs, recordsPanel, recordsRegion, say, signIn, titles, uniqueName } from "./helpers";

test("AC-13 unrecognised phrase: nothing is saved, assistant says it did not understand and gives examples", async ({ page }) => {
  await openAs(page, uniqueName("Анна"));
  const reply = await say(page, "Как дела на Марсе?");
  const text = reply.messages[1].text;
  expect(norm(text)).toContain("не понял");
  const examples = text.match(/«[^»]+»/g) ?? [];
  expect(examples.length).toBeGreaterThanOrEqual(2);
  expect(examples.length).toBeLessThanOrEqual(3);
  await expect(feed(page)).toContainText(/не понял/i);
  expect((await recordsPanel(page.request)).items).toHaveLength(0);
});

test.describe("AC-14 meeting conflicts (a meeting lasts one hour)", () => {
  test.beforeEach(async ({ request }) => {
    await signIn(request, uniqueName("Анна"));
    await chat(request, "Добавь встречу с командой завтра в 15:00");
  });

  test("AC-14 same time: names the conflict, asks, 'да' saves", async ({ request }) => {
    const ask = await chat(request, "Добавь встречу с клиентом завтра в 15:00");
    expect(ask.awaiting).toBe("yes_no");
    expect(norm(ask.messages[1].text)).toContain("встреча с командой");
    expect(ask.messages[1].text).toContain("Всё равно поставить?");
    expect((await recordsPanel(request)).items).toHaveLength(1);

    const yes = await chat(request, "да");
    expect(yes.awaiting).toBeNull();
    const { items } = await recordsPanel(request);
    expect(items).toHaveLength(2);
    expect(items.find((i) => norm(i.title).includes("клиент"))).toMatchObject({ kind: "meeting", date: "2026-10-20", time: "15:00" });
  });

  test("AC-14 same time: 'нет' saves nothing", async ({ request }) => {
    const ask = await chat(request, "Добавь встречу с клиентом завтра в 15:00");
    expect(ask.awaiting).toBe("yes_no");
    const no = await chat(request, "нет");
    expect(no.awaiting).toBeNull();
    const { items } = await recordsPanel(request);
    expect(titles(items)).toEqual(["встреча с командой"]);
  });

  test("AC-14 15:30 overlaps the 15:00-16:00 meeting too", async ({ request }) => {
    const ask = await chat(request, "Добавь встречу с клиентом завтра в 15:30");
    expect(ask.awaiting).toBe("yes_no");
    expect(ask.messages[1].text).toContain("Всё равно поставить?");
    expect((await recordsPanel(request)).items).toHaveLength(1);
  });

  test("AC-14 16:00 does not conflict and is created at once", async ({ request }) => {
    const reply = await chat(request, "Добавь встречу с клиентом завтра в 16:00");
    expect(reply.awaiting).toBeNull();
    expect(reply.messages[1].text).not.toContain("Всё равно поставить?");
    const { items } = await recordsPanel(request);
    expect(items).toHaveLength(2);
    expect(items.find((i) => norm(i.title).includes("клиент"))).toMatchObject({ date: "2026-10-20", time: "16:00" });
  });
});

test("AC-15 complete a task; delete asks first; 'да' deletes it from the list and from search", async ({ page }) => {
  await openAs(page, uniqueName("Анна"));
  await say(page, "Поставь задачу купить билеты до конца недели");
  const row = recordsRegion(page).getByRole("listitem").filter({ hasText: "купить билеты" });
  await expect(row).toBeVisible();
  await expect(row).not.toContainText("Выполнено");

  await say(page, "Отметь задачу купить билеты выполненной");
  await expect(row).toContainText("Выполнено");
  expect((await recordsPanel(page.request)).items[0].done).toBe(true);

  const ask = await say(page, "Удали задачу купить билеты");
  expect(ask.messages[1].text).toContain("Удалить задачу «купить билеты»?");
  expect(ask.awaiting).toBe("yes_no");
  await expect(row).toBeVisible();
  expect((await recordsPanel(page.request)).items).toHaveLength(1);

  const yes = await say(page, "да");
  expect(yes.awaiting).toBeNull();
  await expect(recordsRegion(page).getByRole("listitem").filter({ hasText: "купить билеты" })).toHaveCount(0);
  expect((await recordsPanel(page.request)).items).toHaveLength(0);

  const search = await say(page, "Найди задачу про билеты");
  expect(search.panel.items).toHaveLength(0);
});

test("AC-15 'нет' to the delete question keeps the record with its status", async ({ page }) => {
  await openAs(page, uniqueName("Анна"));
  await say(page, "Поставь задачу купить билеты до конца недели");
  const ask = await say(page, "Удали задачу купить билеты");
  expect(ask.messages[1].text).toContain("Удалить задачу «купить билеты»?");

  const no = await say(page, "нет");
  expect(no.awaiting).toBeNull();
  const row = recordsRegion(page).getByRole("listitem").filter({ hasText: "купить билеты" });
  await expect(row).toBeVisible();
  await expect(row).not.toContainText("Выполнено");
  const { items } = await recordsPanel(page.request);
  expect(items).toHaveLength(1);
  expect(items[0].done).toBe(false);
});

test("AC-16 'move it to tomorrow' after creating a meeting changes the date and keeps the time", async ({ request }) => {
  await signIn(request, uniqueName("Анна"));
  await chat(request, "В четверг в 11 у меня встреча с дизайнером");
  const reply = await chat(request, "А перенеси её на завтра");
  expect(reply.awaiting).toBeNull();
  expect(norm(reply.messages[1].text)).toMatch(/перенес/);
  expect(reply.messages[1].text).toContain("20 октября");
  const { items } = await recordsPanel(request);
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({ kind: "meeting", date: "2026-10-20", time: "11:00" });
  expect(norm(items[0].title)).toBe("встреча с дизайнером");
});

test("AC-16 in a new dialog the same phrase changes nothing and asks which record", async ({ request }) => {
  await signIn(request, uniqueName("Анна"));
  const reply = await chat(request, "А перенеси её на завтра");
  expect(reply.messages[1].text).toContain("Какую запись перенести?");
  expect(reply.awaiting).toBe("target");
  expect((await recordsPanel(request)).items).toHaveLength(0);

  // A record created before «Новый диалог» is forgotten as the context.
  await chat(request, "Поставь задачу купить хлеб послезавтра");
  const reset = await request.post("/api/dialog/reset");
  expect(reset.ok()).toBe(true);
  const again = await chat(request, "перенеси её на завтра");
  expect(again.messages[1].text).toContain("Какую запись перенести?");
  const { items } = await recordsPanel(request);
  expect(items[0]).toMatchObject({ date: "2026-10-21" });
});

test("AC-17 several matches: assistant lists them and asks to choose; the chosen one is confirmed then deleted", async ({ page }) => {
  await openAs(page, uniqueName("Анна"));
  await say(page, "Поставь задачу подготовить отчёт для банка");
  await say(page, "Поставь задачу подготовить отчёт для клиента");
  await expect(recordsRegion(page).getByRole("listitem")).toHaveCount(2);

  const list = await say(page, "Удали задачу про отчёт");
  expect(list.messages[1].text).toBe(
    "Нашёл несколько задач: 1. подготовить отчёт для банка; 2. подготовить отчёт для клиента. Какую удалить?",
  );
  expect(list.awaiting).toBe("choice");
  expect((await recordsPanel(page.request)).items).toHaveLength(2);

  const confirm = await say(page, "2");
  expect(confirm.messages[1].text).toContain("Удалить задачу «подготовить отчёт для клиента»?");
  expect(confirm.awaiting).toBe("yes_no");
  expect((await recordsPanel(page.request)).items).toHaveLength(2);

  await say(page, "да");
  const { items } = await recordsPanel(page.request);
  expect(titles(items)).toEqual(["подготовить отчет для банка"]);
  await expect(recordsRegion(page)).toContainText("подготовить отчёт для банка");
  await expect(recordsRegion(page)).not.toContainText("для клиента");
});

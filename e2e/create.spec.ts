import { expect, test } from "@playwright/test";
import { chat, feed, norm, openAs, recordsPanel, recordsRegion, say, signIn, titles, uniqueName } from "./helpers";

// Frozen clock: Monday 2026-10-19 10:00 Europe/Moscow.

test("AC-01 reminder for tomorrow 10:00 is saved, confirmed with date and time and shown in the list", async ({ page }) => {
  await openAs(page, uniqueName("Анна"));
  const reply = await say(page, "Напомни мне завтра в 10 утра позвонить Ивану");

  expect(reply.messages[1].text).toContain("20 октября");
  expect(reply.messages[1].text).toContain("10:00");
  expect(reply.messages[1].text).toContain("позвонить Ивану");
  await expect(feed(page)).toContainText("позвонить Ивану");

  const row = recordsRegion(page).getByRole("listitem").filter({ hasText: "позвонить Ивану" });
  await expect(row).toBeVisible();
  await expect(row).toContainText("Напоминание");

  const panel = await recordsPanel(page.request);
  expect(panel.items).toHaveLength(1);
  expect(panel.items[0]).toMatchObject({ kind: "reminder", date: "2026-10-20", time: "10:00", done: false });
  expect(norm(panel.items[0].title)).toContain("позвонить ивану");
});

test("AC-02 task for Friday without a time is saved without asking about time", async ({ request }) => {
  await signIn(request, uniqueName("Анна"));
  const reply = await chat(request, "В пятницу нужно отправить отчет");

  expect(reply.awaiting).toBeNull();
  expect(reply.messages[1].text).not.toContain("?");
  const { items } = await recordsPanel(request);
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({ kind: "task", date: "2026-10-23", time: null });
  expect(norm(items[0].title)).toContain("отправить отчет");
});

test("AC-03 task 'until the end of the week' gets Sunday as the deadline, no time, and the reply names it", async ({ request }) => {
  await signIn(request, uniqueName("Анна"));
  const reply = await chat(request, "Поставь задачу купить билеты до конца недели");

  expect(reply.awaiting).toBeNull();
  expect(reply.messages[1].text).toContain("25 октября");
  const { items } = await recordsPanel(request);
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({ kind: "task", date: "2026-10-25", time: null });
  expect(norm(items[0].title)).toContain("купить билеты");
});

test("AC-04 meetings are created for 'tomorrow 15:00' and 'Thursday at 11'", async ({ request }) => {
  await signIn(request, uniqueName("Анна"));

  const first = await chat(request, "Добавь встречу с командой завтра в 15:00");
  expect(first.awaiting).toBeNull();
  expect(first.messages[1].text).toMatch(/встреч/i);
  expect(first.messages[1].text).toContain("20 октября");
  expect(first.messages[1].text).toContain("15:00");

  const second = await chat(request, "В четверг в 11 у меня встреча с дизайнером");
  expect(second.awaiting).toBeNull();
  expect(second.messages[1].text).toMatch(/встреч/i);
  expect(second.messages[1].text).toContain("22 октября");
  expect(second.messages[1].text).toContain("11:00");

  const { items } = await recordsPanel(request);
  expect(items).toHaveLength(2);
  const team = items.find((i) => norm(i.title) === "встреча с командой");
  const designer = items.find((i) => norm(i.title) === "встреча с дизайнером");
  expect(team).toMatchObject({ kind: "meeting", date: "2026-10-20", time: "15:00" });
  expect(designer).toMatchObject({ kind: "meeting", date: "2026-10-22", time: "11:00" });
});

test("AC-05 meeting without a time: assistant asks, saves nothing, then saves after 'в 14:30'", async ({ page }) => {
  await openAs(page, uniqueName("Анна"));

  const question = await say(page, "Поставь встречу с Иваном завтра");
  expect(question.messages[1].text).toContain("На какое время поставить встречу?");
  expect(question.awaiting).toBe("slot");
  await expect(feed(page)).toContainText("На какое время поставить встречу?");
  await expect(recordsRegion(page)).toContainText("Записей пока нет");
  expect((await recordsPanel(page.request)).items).toHaveLength(0);

  const answer = await say(page, "в 14:30");
  expect(answer.awaiting).toBeNull();
  expect(answer.messages[1].text).toContain("14:30");
  expect(answer.messages[1].text).toContain("20 октября");

  const row = recordsRegion(page).getByRole("listitem").filter({ hasText: "Иван" });
  await expect(row).toBeVisible();
  await expect(row).toContainText("Встреча");
  const { items } = await recordsPanel(page.request);
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({ kind: "meeting", date: "2026-10-20", time: "14:30" });
});

test("AC-06 relative dates: in two hours, the day after tomorrow, next week, today", async ({ request }) => {
  await signIn(request, uniqueName("Анна"));

  await chat(request, "Напомни через два часа выпить воды");
  await chat(request, "Поставь задачу позвонить в банк послезавтра");
  const all = (await recordsPanel(request)).items;
  const water = all.find((i) => norm(i.title).includes("выпить воды"));
  const bank = all.find((i) => norm(i.title).includes("позвонить в банк"));
  expect(water).toMatchObject({ kind: "reminder", date: "2026-10-19", time: "12:00" });
  expect(bank).toMatchObject({ kind: "task", date: "2026-10-21" });

  // Records around the week boundaries to check the listed periods.
  await chat(request, "Поставь задачу купить хлеб 25 октября");
  await chat(request, "Поставь задачу купить молоко 26 октября");
  await chat(request, "Поставь задачу купить сыр 1 ноября");
  await chat(request, "Поставь задачу купить чай 2 ноября");
  await chat(request, "Поставь задачу купить сахар сегодня");

  const nextWeek = await chat(request, "Что у меня на следующей неделе?");
  expect(titles(nextWeek.panel.items).sort()).toEqual(["купить молоко", "купить сыр"]);
  for (const item of nextWeek.panel.items) {
    expect(item.date! >= "2026-10-26" && item.date! <= "2026-11-01").toBe(true);
  }

  const today = await chat(request, "Что у меня сегодня?");
  const todayTitles = titles(today.panel.items);
  expect(todayTitles).toContain("купить сахар");
  expect(todayTitles.some((t) => t.includes("выпить воды"))).toBe(true);
  expect(todayTitles).not.toContain("купить хлеб");
  for (const item of today.panel.items) expect(item.date).toBe("2026-10-19");
});

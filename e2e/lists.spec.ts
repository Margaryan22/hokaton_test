import { expect, test } from "@playwright/test";
import { chat, feed, norm, openAs, recordsRegion, say, signIn, titles, uniqueName } from "./helpers";

test("AC-07 three phrasings mean 'list for today'; screen and reply show the same records", async ({ page }) => {
  await openAs(page, uniqueName("Анна"));
  await say(page, "Добавь встречу с дизайнером сегодня в 11:00");
  await say(page, "Поставь задачу отправить отчет сегодня");
  await say(page, "Поставь задачу забрать посылку завтра");

  for (const phrase of ["Что у меня сегодня?", "Какие планы на сегодня?"]) {
    const reply = await say(page, phrase);
    expect(titles(reply.panel.items).sort(), phrase).toEqual(["встреча с дизайнером", "отправить отчет"]);
    for (const item of reply.panel.items) expect(item.date).toBe("2026-10-19");
    expect(norm(reply.messages[1].text)).toContain("дизайнером");
    expect(norm(reply.messages[1].text)).toContain("отправить отчет");
    expect(norm(reply.messages[1].text)).not.toContain("забрать посылку");
    const rows = recordsRegion(page).getByRole("listitem");
    await expect(rows).toHaveCount(2);
    await expect(recordsRegion(page)).toContainText("встреча с дизайнером");
    await expect(recordsRegion(page)).toContainText("отправить отчет");
  }

  const meetings = await say(page, "Покажи мои встречи на сегодня");
  expect(titles(meetings.panel.items)).toEqual(["встреча с дизайнером"]);
  expect(meetings.panel.items[0].kind).toBe("meeting");
  expect(norm(meetings.messages[1].text)).toContain("дизайнером");
  expect(norm(meetings.messages[1].text)).not.toContain("отправить отчет");
  await expect(recordsRegion(page).getByRole("listitem")).toHaveCount(1);
  await expect(feed(page)).toContainText("Покажи мои встречи на сегодня");
});

test("AC-08 tasks for tomorrow only; this week sorted by date and time", async ({ request }) => {
  await signIn(request, uniqueName("Анна"));
  await chat(request, "Добавь встречу с Петром завтра в 12:00");
  await chat(request, "Поставь задачу купить хлеб завтра");
  await chat(request, "Поставь задачу купить молоко 21 октября");

  const tomorrow = await chat(request, "Какие задачи у меня на завтра?");
  expect(titles(tomorrow.panel.items)).toEqual(["купить хлеб"]);
  expect(tomorrow.panel.items[0]).toMatchObject({ kind: "task", date: "2026-10-20" });
  expect(norm(tomorrow.messages[1].text)).not.toContain("встреча с петром");

  // A second user gets a clean week with records added out of order.
  await signIn(request, uniqueName("Анна"));
  await chat(request, "Поставь задачу купить сыр 24 октября");
  await chat(request, "Добавь встречу с Петром 20 октября в 15:00");
  await chat(request, "Добавь встречу с Олегом 20 октября в 09:00");
  await chat(request, "Поставь задачу купить чай 26 октября");

  const week = await chat(request, "Что запланировано на эту неделю?");
  expect(titles(week.panel.items)).toEqual(["встреча с олегом", "встреча с петром", "купить сыр"]);
  for (const item of week.panel.items) {
    expect(item.date! >= "2026-10-19" && item.date! <= "2026-10-25").toBe(true);
  }
});

test("AC-08 'are there meetings today' answers yes or no and lists the meetings", async ({ request }) => {
  await signIn(request, uniqueName("Анна"));
  const none = await chat(request, "Есть ли у меня встречи сегодня?");
  expect(none.messages[1].text).toMatch(/^Нет/);
  expect(none.panel.items).toHaveLength(0);

  await chat(request, "Добавь встречу с дизайнером сегодня в 16:00");
  const some = await chat(request, "Есть ли у меня встречи сегодня?");
  expect(some.messages[1].text).toMatch(/^Да/);
  expect(norm(some.messages[1].text)).toContain("дизайнером");
  expect(titles(some.panel.items)).toEqual(["встреча с дизайнером"]);
});

test("AC-09 empty period: 'nothing planned for <period>' and an empty list", async ({ page }) => {
  await openAs(page, uniqueName("Анна"));

  const today = await say(page, "Что у меня сегодня?");
  expect(today.messages[1].text).toContain("На сегодня ничего не запланировано");
  expect(today.panel.items).toHaveLength(0);
  await expect(feed(page)).toContainText("На сегодня ничего не запланировано");
  await expect(recordsRegion(page).getByRole("listitem")).toHaveCount(0);

  const tomorrow = await say(page, "Что у меня завтра?");
  expect(tomorrow.messages[1].text).toContain("На завтра ничего не запланировано");

  const nextWeek = await say(page, "Что у меня на следующей неделе?");
  expect(nextWeek.messages[1].text).toContain("На следующую неделю ничего не запланировано");
  expect(nextWeek.panel.items).toHaveLength(0);
});

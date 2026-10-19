import { expect, test, type Page } from "@playwright/test";
import { chat, feed, openAs, recordsPanel, recordsRegion, say, signIn, spoken, stubSpeech, uniqueName } from "./helpers";

const NOTICE = "Голосовой ввод недоступен, введите текст";

/** A fake speech recogniser so that the page considers voice input supported. */
async function fakeRecognition(page: Page, mode: "ok" | "denied") {
  await page.addInitScript((m) => {
    class FakeRecognition extends EventTarget {
      lang = "";
      continuous = false;
      interimResults = false;
      onerror: ((e: Event) => void) | null = null;
      onend: ((e: Event) => void) | null = null;
      onresult: ((e: Event) => void) | null = null;
      onstart: ((e: Event) => void) | null = null;
      start() {
        queueMicrotask(() => {
          if (m === "denied") {
            const e = Object.assign(new Event("error"), { error: "not-allowed", message: "" });
            this.onerror?.(e);
            this.dispatchEvent(e);
          }
          const end = new Event("end");
          this.onend?.(end);
          this.dispatchEvent(end);
        });
      }
      stop() {}
      abort() {}
    }
    Object.assign(window, { SpeechRecognition: FakeRecognition, webkitSpeechRecognition: FakeRecognition });
  }, mode);
}

test("AC-18 page has mic, text field with send, dialog feed, records list and a sound toggle (on by default); replies are spoken when on", async ({ page }) => {
  await stubSpeech(page);
  await fakeRecognition(page, "ok");
  await openAs(page, uniqueName("Анна"));

  await expect(page.getByRole("button", { name: "Записать голос" })).toBeVisible();
  await expect(page.getByLabel("Сообщение", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Отправить", exact: true })).toBeVisible();
  await expect(feed(page)).toBeVisible();
  await expect(recordsRegion(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Звук: вкл", exact: true })).toBeVisible();

  const reply = await say(page, "Что у меня сегодня?");
  await expect(feed(page)).toContainText(reply.messages[1].text);
  await expect.poll(async () => (await spoken(page)).length).toBe(1);
  expect((await spoken(page))[0]).toContain("На сегодня ничего не запланировано");
});

test("AC-18 sound off: reply only as text, nothing is spoken; the state survives a reload", async ({ page }) => {
  await stubSpeech(page);
  await openAs(page, uniqueName("Анна"));

  await page.getByRole("button", { name: "Звук: вкл", exact: true }).click();
  await expect(page.getByRole("button", { name: "Звук: выкл", exact: true })).toBeVisible();

  const reply = await say(page, "Что у меня сегодня?");
  await expect(feed(page)).toContainText(reply.messages[1].text);
  expect(await spoken(page)).toEqual([]);

  await page.reload();
  await expect(page.getByRole("button", { name: "Звук: выкл", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Звук: выкл", exact: true }).click();
  await expect(page.getByRole("button", { name: "Звук: вкл", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Звук: вкл", exact: true })).toBeVisible();
});

test("AC-19 no speech recognition in the browser: mic is disabled with the notice, text input works fully", async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, { SpeechRecognition: undefined, webkitSpeechRecognition: undefined });
  });
  await openAs(page, uniqueName("Анна"));

  await expect(page.getByRole("button", { name: "Записать голос" })).toBeDisabled();
  await expect(page.getByText(NOTICE, { exact: true })).toBeVisible();

  const reply = await say(page, "Поставь задачу купить хлеб послезавтра");
  expect(reply.panel.items).toHaveLength(1);
  await expect(recordsRegion(page)).toContainText("купить хлеб");
});

test("AC-19 microphone permission denied: mic gets disabled and the notice appears", async ({ page }) => {
  await fakeRecognition(page, "denied");
  await openAs(page, uniqueName("Анна"));

  await page.getByRole("button", { name: "Записать голос" }).click();
  await expect(page.getByText(NOTICE, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Записать голос" })).toBeDisabled();

  const reply = await say(page, "Что у меня сегодня?");
  expect(reply.messages[1].text).toContain("ничего не запланировано");
});

test("AC-20 Anna's records are invisible to Boris in lists and search; switching users needs no password", async ({ page }) => {
  const anna = uniqueName("Анна");
  const boris = uniqueName("Борис");
  await openAs(page, anna);
  await say(page, "Поставь задачу подготовить годовой план завтра");
  await expect(recordsRegion(page)).toContainText("подготовить годовой план");

  // Create Boris with one action from the switcher.
  await page.getByLabel("Новое имя", { exact: true }).fill(boris);
  await page.getByRole("button", { name: "Создать", exact: true }).click();
  await expect(page.getByLabel("Пользователь", { exact: true })).toHaveValue(/.+/);
  await expect(recordsRegion(page)).not.toContainText("подготовить годовой план");
  await expect(recordsRegion(page)).toContainText("Записей пока нет");
  expect((await recordsPanel(page.request)).items).toHaveLength(0);

  const list = await say(page, "Что у меня завтра?");
  expect(list.panel.items).toHaveLength(0);
  const search = await say(page, "Найди задачу про годовой план");
  expect(search.panel.items).toHaveLength(0);
  expect(search.messages[1].text.toLowerCase()).not.toContain("годовой план");

  // Back to Anna by choosing her name.
  await page.getByLabel("Пользователь", { exact: true }).selectOption({ label: anna });
  await expect(recordsRegion(page)).toContainText("подготовить годовой план");
});

test("AC-20 API: another user cannot read or change someone else's record; no session means 401", async ({ playwright, baseURL }) => {
  const annaApi = await playwright.request.newContext({ baseURL });
  const borisApi = await playwright.request.newContext({ baseURL });
  const anonymous = await playwright.request.newContext({ baseURL });
  await signIn(annaApi, uniqueName("Анна"));
  await signIn(borisApi, uniqueName("Борис"));

  await chat(annaApi, "Поставь задачу купить сыр завтра");
  const annaItems = (await recordsPanel(annaApi)).items;
  expect(annaItems).toHaveLength(1);

  expect((await recordsPanel(borisApi)).items).toHaveLength(0);
  const patch = await borisApi.patch(`/api/records/${annaItems[0].id}`, { data: { done: true } });
  expect(patch.status()).toBe(404);
  expect((await recordsPanel(annaApi)).items[0].done).toBe(false);

  expect((await anonymous.get("/api/records")).status()).toBe(401);
  expect((await anonymous.post("/api/chat", { data: { text: "Что у меня сегодня?" } })).status()).toBe(401);

  const users = await (await anonymous.get("/api/users")).json();
  expect(Array.isArray(users.users)).toBe(true);
  await Promise.all([annaApi.dispose(), borisApi.dispose(), anonymous.dispose()]);
});

test("AC-21 a created record and the dialog survive a reload and a new browser session; found by 'Что у меня завтра?'", async ({ page, browser }) => {
  const name = uniqueName("Анна");
  await openAs(page, name);
  await say(page, "Поставь задачу купить сыр завтра");

  await page.reload();
  await expect(feed(page)).toContainText("Поставь задачу купить сыр завтра");
  await expect(recordsRegion(page)).toContainText("купить сыр");
  const tomorrow = await say(page, "Что у меня завтра?");
  expect(tomorrow.panel.items.map((i) => i.title.toLowerCase())).toContain("купить сыр");
  expect(tomorrow.messages[1].text.toLowerCase()).toContain("купить сыр");

  // A fresh browser context (no cookies) picks the same name and sees the same data.
  const context = await browser.newContext();
  const fresh = await context.newPage();
  await fresh.goto("/");
  await fresh.getByLabel("Новое имя", { exact: true }).fill(name);
  await fresh.getByRole("button", { name: "Создать", exact: true }).click();
  await expect(recordsRegion(fresh)).toContainText("купить сыр");
  const again = await say(fresh, "Что у меня завтра?");
  expect(again.panel.items.map((i) => i.title.toLowerCase())).toContain("купить сыр");
  await context.close();
});

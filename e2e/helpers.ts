import { expect, type APIRequestContext, type Page } from "@playwright/test";

// Shapes from docs/architecture.md#4-api. date is "YYYY-MM-DD", time is "HH:mm" (see docs/ui-contract.md).
export type RecordDto = {
  id: number;
  kind: "task" | "meeting" | "reminder";
  title: string;
  date: string | null;
  time: string | null;
  done: boolean;
};
export type MessageDto = { id: number; role: "user" | "assistant"; text: string; items: RecordDto[] | null; createdAt: string };
export type Panel = { title: string; items: RecordDto[]; total: number };
export type Awaiting = "slot" | "yes_no" | "choice" | "target" | null;
export type ChatResponse = { messages: [MessageDto, MessageDto]; panel: Panel; awaiting: Awaiting };

let counter = 0;
/** A user name that no other test uses (tests share one database). */
export function uniqueName(base: string): string {
  counter += 1;
  return `${base}-${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

/** Create or select a user; the session cookie lands in this request context (and in the page, if it is page.request). */
export async function signIn(request: APIRequestContext, name: string): Promise<void> {
  const response = await request.post("/api/session", { data: { name } });
  expect(response.ok(), `POST /api/session ${name}: ${await response.text()}`).toBe(true);
}

/** Send a phrase through the same endpoint the page uses. */
export async function chat(request: APIRequestContext, text: string): Promise<ChatResponse> {
  const response = await request.post("/api/chat", { data: { text } });
  expect(response.ok(), `POST /api/chat "${text}": ${await response.text()}`).toBe(true);
  return (await response.json()) as ChatResponse;
}

export async function recordsPanel(request: APIRequestContext): Promise<Panel> {
  const response = await request.get("/api/records");
  expect(response.ok(), await response.text()).toBe(true);
  return (await response.json()) as Panel;
}

export async function resetDialog(request: APIRequestContext): Promise<void> {
  const response = await request.post("/api/dialog/reset");
  expect(response.ok()).toBe(true);
}

/** ё -> е, lower case: for comparing titles without caring about spelling variants. */
export function norm(text: string): string {
  return text.toLowerCase().replaceAll("ё", "е");
}

export function titles(items: RecordDto[]): string[] {
  return items.map((item) => norm(item.title));
}

/** Type a phrase into the page and send it; resolves with the server reply. */
export async function say(page: Page, text: string): Promise<ChatResponse> {
  await page.getByLabel("Сообщение", { exact: true }).fill(text);
  const reply = page.waitForResponse((r) => r.url().endsWith("/api/chat") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Отправить", exact: true }).click();
  const response = await reply;
  expect(response.ok(), await response.text()).toBe(true);
  return (await response.json()) as ChatResponse;
}

/** Sign the page in as `name` (through the API, cookie shared) and open the home page. */
export async function openAs(page: Page, name: string): Promise<void> {
  await signIn(page.request, name);
  await page.goto("/");
  await expect(page.getByLabel("Сообщение", { exact: true })).toBeEnabled();
}

export function feed(page: Page) {
  return page.getByRole("log");
}

export function recordsRegion(page: Page) {
  return page.getByRole("region", { name: "Записи" });
}

/** Stub speech synthesis so tests can see what would be spoken. */
export async function stubSpeech(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __spoken: string[] };
    w.__spoken = [];
    window.speechSynthesis.speak = (utterance: SpeechSynthesisUtterance) => {
      w.__spoken.push(utterance.text);
    };
  });
}

export async function spoken(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);
}

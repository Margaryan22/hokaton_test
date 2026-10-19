import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { chat, norm, recordsPanel, resetDialog, signIn, uniqueName } from "./helpers";

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

test("AC-23 no paid API key is needed: no key variables or LLM SDKs, and the main phrases work", async ({ request }) => {
  const envExample = existsSync(path.join(root, ".env.example")) ? read(".env.example") : "";
  expect(envExample).not.toMatch(/^\s*[A-Z_]*(API_KEY|SECRET_KEY|OPENAI|ANTHROPIC)[A-Z_]*\s*=\s*\S+/m);
  const pkg = JSON.parse(read("package.json")) as { dependencies?: Record<string, string> };
  const deps = Object.keys(pkg.dependencies ?? {});
  for (const forbidden of ["openai", "@anthropic-ai/sdk", "@google/generative-ai", "cohere-ai"]) {
    expect(deps).not.toContain(forbidden);
  }

  // The e2e server runs without any key; the phrases of AC-01..AC-08, AC-10 give their results.
  await signIn(request, uniqueName("Анна"));
  const reminder = await chat(request, "Напомни мне завтра в 10 утра позвонить Ивану");
  expect(reminder.messages[1].text).toContain("20 октября в 10:00");
  const task = await chat(request, "В пятницу нужно отправить отчет");
  expect(task.awaiting).toBeNull();
  const question = await chat(request, "Поставь встречу с Иваном завтра");
  expect(question.messages[1].text).toContain("На какое время поставить встречу?");
  await chat(request, "в 14:30");
  const today = await chat(request, "Что у меня на этой неделе?");
  expect(today.panel.items.length).toBe(3);
  expect((await recordsPanel(request)).items.length).toBe(3);

  await signIn(request, "Демо");
  await resetDialog(request);
  const search = await chat(request, "Найди задачу про презентацию");
  expect(search.panel.items.length).toBeGreaterThan(0);
  expect(search.panel.items.every((i) => i.kind === "task" && /презентац/i.test(i.title))).toBe(true);
});

test("AC-24 README has run instructions, technology choice, own decisions, what to improve; architecture doc has the four layers", async () => {
  const readme = norm(read("README.md"));
  expect(readme).toMatch(/запуск|быстрый старт/);
  expect(readme).toMatch(/npm run (setup|dev)/);
  expect(readme).toMatch(/деплой/);
  expect(readme).toMatch(/^#+ .*технолог/m);
  expect(readme).toMatch(/^#+ .*(самостоятельн|принят\w* решени|решени\w* (команд|автор))/m);
  expect(readme).toMatch(/^#+ .*(что улучшить|улучшени|доработк)/m);
  expect(readme).toContain("docs/architecture.md");

  const architecture = norm(read("docs/architecture.md"));
  for (const layer of ["голос", "бизнес-логик", "хранени", "понимани"]) {
    expect(architecture).toContain(layer);
  }
});

import { expect, test } from "@playwright/test";
import { chat, signIn, uniqueName } from "./helpers";

// Natural paraphrases through the chat API (clock frozen at 2026-10-19 10:00 MSK, Monday).
test.describe("paraphrases", () => {
  test.beforeEach(async ({ request }) => {
    await signIn(request, uniqueName("para"));
  });

  const creates: [string, string, string | null, string][] = [
    ["Не забудь напомнить мне завтра в 9 вечера про лекарство", "reminder", "2026-10-20", "21:00"],
    ["Запиши встречу с врачом в среду в 15:30", "meeting", "2026-10-21", "15:30"],
    ["Назначь встречу с Петровым послезавтра в 11", "meeting", "2026-10-21", "11:00"],
    ["Напомни в пятницу в 18:00 забрать посылку", "reminder", "2026-10-23", "18:00"],
    ["Надо купить молоко завтра", "task", "2026-10-20", ""],
    ["Создай задачу подготовить презентацию на понедельник", "task", "2026-10-26", ""],
    ["Напомни через 30 минут позвонить маме", "reminder", "2026-10-19", "10:30"],
  ];
  for (const [text, kind, date, time] of creates) {
    test(`create: ${text}`, async ({ request }) => {
      const res = await chat(request, text);
      const item = res.panel.items[0] ?? res.messages[1].items?.[0];
      expect(item, res.messages[1].text).toBeTruthy();
      expect(item.kind).toBe(kind);
      expect(item.date).toBe(date);
      if (time) expect(item.time).toBe(time);
    });
  }

  const lists = [
    "Что у меня запланировано на завтра?",
    "Покажи планы на эту неделю",
    "Какие у меня дела на сегодня",
    "Что у меня на следующей неделе?",
  ];
  for (const text of lists) {
    test(`list: ${text}`, async ({ request }) => {
      const res = await chat(request, text);
      expect(res.messages[1].text).not.toMatch(/не понял|не поняла/i);
      expect(res.awaiting).toBeNull();
    });
  }

  test("search paraphrases find the saved record", async ({ request }) => {
    await chat(request, "Напомни завтра в 10 позвонить стоматологу");
    for (const text of ["Найди про стоматолога", "Есть ли что-нибудь про стоматолога?"]) {
      const res = await chat(request, text);
      expect(JSON.stringify(res), text).toContain("стоматолог");
      expect(res.messages[1].text, text).not.toMatch(/не понял|ничего не нашла|ничего не нашёл/i);
    }
  });
});

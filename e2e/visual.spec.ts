import { expect, test } from "@playwright/test";
import { chat, signIn, uniqueName } from "./helpers";

// Visual review: screenshots under test-results/visual/ (not committed), plus a no-horizontal-scroll check.
for (const [label, width, height] of [
  ["desktop", 1280, 800],
  ["phone", 375, 700],
] as const) {
  test(`visual ${label}: main page empty and filled, no horizontal scroll`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const name = uniqueName("vis");
    await signIn(page.request, name);
    await page.goto("/");
    await page.getByRole("button", { name: "Отправить" }).waitFor();
    await page.screenshot({ path: `test-results/visual/${label}-empty.png`, fullPage: true });

    await chat(page.request, "Напомни завтра в 9 утра позвонить маме");
    await chat(page.request, "Добавь задачу купить молоко");
    await chat(page.request, "Что у меня завтра?");
    await chat(page.request, "Поставь встречу");
    await page.goto("/");
    await page.getByRole("button", { name: "Отправить" }).waitFor();
    await page.screenshot({ path: `test-results/visual/${label}-filled.png`, fullPage: true });

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

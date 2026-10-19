import { expect, test } from "@playwright/test";

test("home page opens", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Голосовой ассистент" })).toBeVisible();
});

test("health check reaches the database with the frozen clock", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBe(true);
  expect(await response.json()).toEqual({ ok: true, now: "2026-10-19T10:00:00.000+03:00" });
});

test("page is not stuck in a reload loop: message field is enabled after sign-in", async ({ page }) => {
  const name = `Смоук ${Date.now()}`;
  const response = await page.request.post("/api/session", { data: { name } });
  expect(response.ok()).toBe(true);
  await page.goto("/");
  await expect(page.getByLabel("Сообщение", { exact: true })).toBeEnabled();
  let navigations = 0;
  page.on("framenavigated", () => navigations++);
  await page.waitForTimeout(1500); // observation window for a reload loop, not a wait for state
  expect(navigations).toBe(0);
});

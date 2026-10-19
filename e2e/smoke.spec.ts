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

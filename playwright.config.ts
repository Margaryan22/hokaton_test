import { defineConfig, devices } from "@playwright/test";

// The server is a production build (own distDir): `next dev` HMR loops with a custom distDir.
// End-to-end tests run against their own database and a frozen clock
// (Monday 2026-10-19 10:00 Moscow time, as in the acceptance criteria of .crew/brief.md).
const PORT = 3100;
export const E2E_ENV = {
  DATABASE_URL: "file:./data/e2e.db",
  DATABASE_AUTH_TOKEN: "",
  APP_NOW: "2026-10-19T10:00:00+03:00",
  NEXT_DIST_DIR: ".next-e2e",
  RATE_LIMIT_DISABLED: "1",
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "ru-RU",
    timezoneId: "Europe/Moscow",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `tsx e2e/prepare-db.ts && next build && next start --port ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 240_000,
    env: E2E_ENV,
    stdout: "ignore",
    stderr: "pipe",
  },
});

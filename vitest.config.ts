import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: [...configDefaults.exclude, "e2e/**"],
    environment: "node",
    env: {
      APP_NOW: "2026-10-19T10:00:00+03:00",
      DATABASE_URL: "file::memory:",
    },
  },
});

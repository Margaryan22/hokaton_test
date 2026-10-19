import { existsSync } from "node:fs";

// CLI scripts (migrate, seed) run outside Next.js, which loads .env by itself.
// Variables already set in the environment win over the file.
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

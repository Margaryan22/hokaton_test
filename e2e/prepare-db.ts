import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

// Fresh database for every end-to-end run: delete, migrate, seed.
const url = process.env.DATABASE_URL ?? "";
if (!url.startsWith("file:./data/e2e")) {
  throw new Error(`Refusing to reset a non-e2e database: ${url}`);
}
const file = url.slice("file:".length);
for (const suffix of ["", "-wal", "-shm"]) {
  rmSync(file + suffix, { force: true });
}
execSync("npm run db:migrate && npm run db:seed", { stdio: "inherit", env: process.env });

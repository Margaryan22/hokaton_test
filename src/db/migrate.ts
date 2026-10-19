import "./load-env";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";

const url = process.env.DATABASE_URL ?? "file:./data/app.db";
if (url.startsWith("file:")) {
  // libSQL creates the database file but not its folder.
  mkdirSync(dirname(url.slice("file:".length)), { recursive: true });
}

const { db } = await import("./client");
await migrate(db, { migrationsFolder: "./drizzle" });
console.log(`Migrations applied to ${url.startsWith("file:") ? url : "remote database"}`);

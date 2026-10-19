import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

// Local: DATABASE_URL=file:./data/app.db (an embedded SQLite file).
// Hosted: DATABASE_URL=libsql://<db>.turso.io plus DATABASE_AUTH_TOKEN.
export const databaseUrl = process.env.DATABASE_URL ?? "file:./data/app.db";

const client = createClient({
  url: databaseUrl,
  authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
});

export const db = drizzle({ client, schema });
export type Db = typeof db;

import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// Tables are snake_case; timestamps are UTC milliseconds (integer, mode "timestamp_ms").
// The full data model is in docs/architecture.md#data-model.

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("users_name_unique").on(t.name)],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

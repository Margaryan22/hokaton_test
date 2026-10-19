import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// Tables are snake_case; timestamps are UTC milliseconds (integer, mode "timestamp_ms").
// The full data model is in docs/architecture.md#2-модель-данных.

const nowMs = sql`(unixepoch() * 1000)`;

export const RECORD_KINDS = ["task", "meeting", "reminder"] as const;
export type RecordKind = (typeof RECORD_KINDS)[number];

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    // As typed by the user, 1-40 characters after trim.
    name: text("name").notNull(),
    // normalize(name): lower case, ё -> е, collapsed spaces. "анна" and "Анна" are one user.
    // The default "" only lets the column be added to a database that already has users
    // (0001 migration); the repository always writes the real key, and backfillNameKeys() repairs old rows.
    nameKey: text("name_key").notNull().default(""),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  },
  (t) => [uniqueIndex("users_name_key_unique").on(t.nameKey)],
);

export const records = sqliteTable(
  "records",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: RECORD_KINDS }).notNull(),
    title: text("title").notNull(),
    // Moscow calendar day, YYYY-MM-DD (ADR-004).
    dueDate: text("due_date"),
    // UTC instant; set only together with dueDate.
    startsAt: integer("starts_at", { mode: "timestamp_ms" }),
    done: integer("done", { mode: "boolean" }).notNull().default(false),
    // id of the CSV row this record was imported from (ADR-006).
    sourceId: integer("source_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  },
  (t) => [
    index("records_user_due_idx").on(t.userId, t.dueDate),
    uniqueIndex("records_user_source_unique").on(t.userId, t.sourceId),
    check("records_title_length", sql`length(${t.title}) BETWEEN 1 AND 200`),
    check("records_kind_valid", sql`${t.kind} IN ('task', 'meeting', 'reminder')`),
    check("records_starts_at_needs_due_date", sql`${t.startsAt} IS NULL OR ${t.dueDate} IS NOT NULL`),
    check("records_due_date_format", sql`${t.dueDate} IS NULL OR ${t.dueDate} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'`),
  ],
);

export const dialogMessages = sqliteTable(
  "dialog_messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    text: text("text").notNull(),
    // Snapshot of the RecordDto[] shown in the assistant reply.
    itemsJson: text("items_json"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  },
  (t) => [
    index("dialog_messages_user_idx").on(t.userId, t.id),
    check("dialog_messages_role_valid", sql`${t.role} IN ('user', 'assistant')`),
    check("dialog_messages_user_text_length", sql`${t.role} <> 'user' OR length(${t.text}) <= 500`),
  ],
);

export const dialogStates = sqliteTable("dialog_states", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  stateJson: text("state_json").notNull().default('{"kind":"idle"}'),
  focusRecordId: integer("focus_record_id").references(() => records.id, { onDelete: "set null" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type RecordRow = typeof records.$inferSelect;
export type NewRecord = typeof records.$inferInsert;
export type DialogMessageRow = typeof dialogMessages.$inferSelect;
export type NewDialogMessage = typeof dialogMessages.$inferInsert;
export type DialogStateRow = typeof dialogStates.$inferSelect;

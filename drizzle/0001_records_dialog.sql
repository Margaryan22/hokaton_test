CREATE TABLE `dialog_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`role` text NOT NULL,
	`text` text NOT NULL,
	`items_json` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "dialog_messages_role_valid" CHECK("dialog_messages"."role" IN ('user', 'assistant')),
	CONSTRAINT "dialog_messages_user_text_length" CHECK("dialog_messages"."role" <> 'user' OR length("dialog_messages"."text") <= 500)
);
--> statement-breakpoint
CREATE INDEX `dialog_messages_user_idx` ON `dialog_messages` (`user_id`,`id`);--> statement-breakpoint
CREATE TABLE `dialog_states` (
	`user_id` integer PRIMARY KEY NOT NULL,
	`state_json` text DEFAULT '{"kind":"idle"}' NOT NULL,
	`focus_record_id` integer,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`focus_record_id`) REFERENCES `records`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`due_date` text,
	`starts_at` integer,
	`done` integer DEFAULT false NOT NULL,
	`source_id` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "records_title_length" CHECK(length("records"."title") BETWEEN 1 AND 200),
	CONSTRAINT "records_kind_valid" CHECK("records"."kind" IN ('task', 'meeting', 'reminder')),
	CONSTRAINT "records_starts_at_needs_due_date" CHECK("records"."starts_at" IS NULL OR "records"."due_date" IS NOT NULL),
	CONSTRAINT "records_due_date_format" CHECK("records"."due_date" IS NULL OR "records"."due_date" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
);
--> statement-breakpoint
CREATE INDEX `records_user_due_idx` ON `records` (`user_id`,`due_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `records_user_source_unique` ON `records` (`user_id`,`source_id`);--> statement-breakpoint
DROP INDEX `users_name_unique`;--> statement-breakpoint
ALTER TABLE `users` ADD `name_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `users_name_key_unique` ON `users` (`name_key`);
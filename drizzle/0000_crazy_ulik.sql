CREATE TABLE `events` (
	`owner` text NOT NULL,
	`id` text NOT NULL,
	`kind` text NOT NULL,
	`detail` text NOT NULL,
	`at` integer NOT NULL,
	PRIMARY KEY(`owner`, `id`)
);
--> statement-breakpoint
CREATE INDEX `events_owner_at` ON `events` (`owner`,`at`);--> statement-breakpoint
CREATE TABLE `leads` (
	`owner` text NOT NULL,
	`id` text NOT NULL,
	`data` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`owner`, `id`)
);
--> statement-breakpoint
CREATE TABLE `outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`lead_id` text NOT NULL,
	`reply` text NOT NULL,
	`status` text NOT NULL,
	`at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `outbox_owner_status` ON `outbox` (`owner`,`status`);--> statement-breakpoint
CREATE TABLE `settings` (
	`owner` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stories` (
	`owner` text NOT NULL,
	`id` text NOT NULL,
	`data` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`owner`, `id`)
);
--> statement-breakpoint
CREATE TABLE `webhook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`at` integer NOT NULL
);

CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`used` integer NOT NULL,
	`expires_at` integer NOT NULL
);

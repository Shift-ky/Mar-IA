CREATE TABLE `join_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`family` text NOT NULL,
	`user` text NOT NULL,
	`email` text NOT NULL,
	`state` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL
);

CREATE TABLE `auth_identities` (
	`subject` text PRIMARY KEY NOT NULL,
	`user` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `profiles` ADD `phone` text;
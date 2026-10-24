CREATE TABLE `wa_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`family` text NOT NULL,
	`user` text NOT NULL,
	`phone` text NOT NULL,
	`hash` text NOT NULL,
	`storage` text NOT NULL,
	`mime` text NOT NULL,
	`state` text NOT NULL,
	`data` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `wa_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`family` text NOT NULL,
	`user` text NOT NULL,
	`phone` text NOT NULL,
	`data` text NOT NULL,
	`state` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `wa_inbox` (
	`id` text PRIMARY KEY NOT NULL,
	`phone` text NOT NULL,
	`payload` text NOT NULL,
	`state` text NOT NULL,
	`lease` text,
	`expires` text,
	`created` text NOT NULL,
	`error` text
);
--> statement-breakpoint
CREATE TABLE `wa_links` (
	`phone` text PRIMARY KEY NOT NULL,
	`user` text NOT NULL,
	`email` text NOT NULL,
	`family` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `wa_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`phone` text NOT NULL,
	`body` text NOT NULL,
	`state` text NOT NULL,
	`created` text NOT NULL,
	`provider_id` text,
	`error` text
);
--> statement-breakpoint
CREATE TABLE `wa_pairings` (
	`hash` text PRIMARY KEY NOT NULL,
	`user` text NOT NULL,
	`email` text NOT NULL,
	`family` text NOT NULL,
	`expires` text NOT NULL
);

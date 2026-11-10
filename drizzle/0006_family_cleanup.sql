-- One-time cleanup requested by the owner: keep individual registrations and
-- identity mappings, remove old family spaces, records and bot connections.
-- Preserve sync receipts so previously committed offline operations cannot replay.
DELETE FROM wa_inbox;
--> statement-breakpoint
DELETE FROM wa_outbox;
--> statement-breakpoint
DELETE FROM wa_pairings;
--> statement-breakpoint
DELETE FROM wa_links;
--> statement-breakpoint
DELETE FROM wa_drafts;
--> statement-breakpoint
UPDATE wa_documents SET state='deleted',data='{}';
--> statement-breakpoint
DELETE FROM records;
--> statement-breakpoint
DELETE FROM join_requests;
--> statement-breakpoint
DELETE FROM members;
--> statement-breakpoint
DELETE FROM families;
--> statement-breakpoint
DELETE FROM settings WHERE key LIKE 'home-family:%' OR key LIKE 'tg-%' OR (key LIKE 'rev:%' AND key NOT LIKE 'rev:profile:%' AND key NOT LIKE 'rev:join:%');
--> statement-breakpoint
INSERT INTO settings(key,value) VALUES('rev:global','cleanup-2026-10-26') ON CONFLICT(key) DO UPDATE SET value=excluded.value;
--> statement-breakpoint
CREATE UNIQUE INDEX members_one_family_per_email ON members(lower(email));

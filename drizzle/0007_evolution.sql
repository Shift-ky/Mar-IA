CREATE TABLE ev_links (sender TEXT PRIMARY KEY, user TEXT NOT NULL, email TEXT NOT NULL, family TEXT NOT NULL);
CREATE TABLE ev_groups (chat TEXT PRIMARY KEY, family TEXT NOT NULL, user TEXT NOT NULL, email TEXT NOT NULL);
CREATE TABLE ev_pairings (hash TEXT PRIMARY KEY, user TEXT NOT NULL, email TEXT NOT NULL, family TEXT NOT NULL, kind TEXT NOT NULL, expires TEXT NOT NULL);
CREATE TABLE ev_inbox (id TEXT PRIMARY KEY, sender TEXT NOT NULL, chat TEXT NOT NULL, payload TEXT NOT NULL, context TEXT, state TEXT NOT NULL, created TEXT NOT NULL, error TEXT);
CREATE TABLE ev_outbox (id TEXT PRIMARY KEY, chat TEXT NOT NULL, body TEXT NOT NULL, context TEXT, state TEXT NOT NULL, lease TEXT, attempted TEXT, provider_id TEXT, error TEXT);
CREATE TABLE ev_documents (id TEXT PRIMARY KEY, family TEXT NOT NULL, user TEXT NOT NULL, hash TEXT NOT NULL, storage TEXT NOT NULL, mime TEXT NOT NULL, state TEXT NOT NULL, data TEXT NOT NULL, created TEXT NOT NULL);
CREATE UNIQUE INDEX ev_document_hash ON ev_documents(family,hash) WHERE state<>'deleted';
CREATE INDEX ev_inbox_state ON ev_inbox(state,created);
CREATE INDEX ev_outbox_state ON ev_outbox(state);
CREATE TRIGGER ev_family_cleanup AFTER DELETE ON families BEGIN
 UPDATE ev_documents SET state='deleted',data='{}' WHERE family=OLD.id;
 DELETE FROM ev_inbox WHERE json_extract(context,'$.family')=OLD.id;
 DELETE FROM ev_outbox WHERE json_extract(context,'$.family')=OLD.id;
 DELETE FROM ev_links WHERE family=OLD.id;
 DELETE FROM ev_groups WHERE family=OLD.id;
 DELETE FROM ev_pairings WHERE family=OLD.id;
END;

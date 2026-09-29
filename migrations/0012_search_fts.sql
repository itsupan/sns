-- Full-text search (#38). Hand-written: drizzle-kit does not generate FTS5 tables or triggers.
--
-- External-content FTS5 indexes over `post` and `user`, keyed by their implicit rowid. The
-- trigram tokenizer matches any substring of 3+ characters (so prefixes too) in every script,
-- including ones written without spaces between words such as Khmer and Thai; bm25() ranks.
-- Triggers keep both indexes in sync. A migration that rebuilds `post` or `user` (drizzle's
-- `__new_*` copy) drops these triggers and changes rowids: recreate them and run 'rebuild'.
-- search.spec.ts runs FTS5 'integrity-check' after all migrations to catch that.
CREATE VIRTUAL TABLE `post_fts` USING fts5(
	`content`,
	`location`,
	content='post',
	content_rowid='rowid',
	tokenize='trigram'
);
--> statement-breakpoint
CREATE VIRTUAL TABLE `user_fts` USING fts5(
	`name`,
	`handle`,
	`bio`,
	content='user',
	content_rowid='rowid',
	tokenize='trigram'
);
--> statement-breakpoint
CREATE TRIGGER `post_fts_ai` AFTER INSERT ON `post` BEGIN
	INSERT INTO `post_fts`(rowid, `content`, `location`) VALUES (new.rowid, new.`content`, new.`location`);
END;
--> statement-breakpoint
CREATE TRIGGER `post_fts_ad` AFTER DELETE ON `post` BEGIN
	INSERT INTO `post_fts`(`post_fts`, rowid, `content`, `location`) VALUES ('delete', old.rowid, old.`content`, old.`location`);
END;
--> statement-breakpoint
-- Only text edits reindex; likes, counters and soft deletes (filtered at query time) do not.
CREATE TRIGGER `post_fts_au` AFTER UPDATE OF `content`, `location` ON `post` BEGIN
	INSERT INTO `post_fts`(`post_fts`, rowid, `content`, `location`) VALUES ('delete', old.rowid, old.`content`, old.`location`);
	INSERT INTO `post_fts`(rowid, `content`, `location`) VALUES (new.rowid, new.`content`, new.`location`);
END;
--> statement-breakpoint
CREATE TRIGGER `user_fts_ai` AFTER INSERT ON `user` BEGIN
	INSERT INTO `user_fts`(rowid, `name`, `handle`, `bio`) VALUES (new.rowid, new.`name`, new.`handle`, new.`bio`);
END;
--> statement-breakpoint
CREATE TRIGGER `user_fts_ad` AFTER DELETE ON `user` BEGIN
	INSERT INTO `user_fts`(`user_fts`, rowid, `name`, `handle`, `bio`) VALUES ('delete', old.rowid, old.`name`, old.`handle`, old.`bio`);
END;
--> statement-breakpoint
-- Sessions and follower counters update `user` often; only profile text edits reindex.
CREATE TRIGGER `user_fts_au` AFTER UPDATE OF `name`, `handle`, `bio` ON `user` BEGIN
	INSERT INTO `user_fts`(`user_fts`, rowid, `name`, `handle`, `bio`) VALUES ('delete', old.rowid, old.`name`, old.`handle`, old.`bio`);
	INSERT INTO `user_fts`(rowid, `name`, `handle`, `bio`) VALUES (new.rowid, new.`name`, new.`handle`, new.`bio`);
END;
--> statement-breakpoint
-- Backfill rows that existed before this migration.
INSERT INTO `post_fts`(`post_fts`) VALUES ('rebuild');
--> statement-breakpoint
INSERT INTO `user_fts`(`user_fts`) VALUES ('rebuild');

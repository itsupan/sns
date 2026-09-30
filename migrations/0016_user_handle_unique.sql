-- Handles were only checked before writing, so a race may have stored duplicates, which would
-- make the index below fail. Keep the handle on the oldest account and clear it on the others
-- (they fall back to a handle derived from their name and can pick a new one).
UPDATE `user` SET `handle` = NULL
WHERE `handle` IS NOT NULL
	AND `rowid` NOT IN (SELECT MIN(`rowid`) FROM `user` WHERE `handle` IS NOT NULL GROUP BY `handle`);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_handle_unique` ON `user` (`handle`);

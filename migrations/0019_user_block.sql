CREATE TABLE `user_block` (
	`blocker_id` text NOT NULL,
	`blocked_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`blocker_id`, `blocked_id`),
	FOREIGN KEY (`blocker_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`blocked_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_block_blockedId_idx` ON `user_block` (`blocked_id`);
--> statement-breakpoint
-- Blocked users never notify each other: an insert between a blocked pair is silently skipped,
-- so every action that notifies (like, comment, reply, reaction, follow) is covered in one place.
CREATE TRIGGER `notification_block_guard` BEFORE INSERT ON `notification`
WHEN EXISTS (
	SELECT 1 FROM `user_block`
	WHERE (`blocker_id` = new.`recipient_id` AND `blocked_id` = new.`actor_id`)
		OR (`blocker_id` = new.`actor_id` AND `blocked_id` = new.`recipient_id`)
)
BEGIN
	SELECT RAISE(IGNORE);
END;

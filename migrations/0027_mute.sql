CREATE TABLE `muted_keyword` (
	`user_id` text NOT NULL,
	`keyword` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`user_id`, `keyword`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_mute` (
	`muter_id` text NOT NULL,
	`muted_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`muter_id`, `muted_id`),
	FOREIGN KEY (`muter_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`muted_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_mute_mutedId_idx` ON `user_mute` (`muted_id`);--> statement-breakpoint
-- Muted users never notify their muter (one-way): the insert is silently skipped, so every action
-- that notifies is covered in one place, like `notification_block_guard`.
CREATE TRIGGER `notification_mute_guard` BEFORE INSERT ON `notification`
WHEN EXISTS (
	SELECT 1 FROM `user_mute`
	WHERE `muter_id` = new.`recipient_id` AND `muted_id` = new.`actor_id`
)
BEGIN
	SELECT RAISE(IGNORE);
END;

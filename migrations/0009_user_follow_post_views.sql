CREATE TABLE `user_follow` (
	`follower_id` text NOT NULL,
	`following_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`follower_id`, `following_id`),
	FOREIGN KEY (`follower_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`following_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_follow_followingId_idx` ON `user_follow` (`following_id`);--> statement-breakpoint
ALTER TABLE `post` ADD `views_count` integer DEFAULT 0 NOT NULL;
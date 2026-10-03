CREATE TABLE `close_friend` (
	`user_id` text NOT NULL,
	`friend_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`user_id`, `friend_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`friend_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `close_friend_friendId_idx` ON `close_friend` (`friend_id`);--> statement-breakpoint
ALTER TABLE `story` ADD `audience` text DEFAULT 'everyone' NOT NULL;
CREATE TABLE `post_mention` (
	`post_id` text NOT NULL,
	`user_id` text NOT NULL,
	PRIMARY KEY(`post_id`, `user_id`),
	FOREIGN KEY (`post_id`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `post_mention_userId_idx` ON `post_mention` (`user_id`);--> statement-breakpoint
ALTER TABLE `message` ADD `story_ref` text;--> statement-breakpoint
ALTER TABLE `post` ADD `background` text;
CREATE TABLE `comment_reaction` (
	`comment_id` text NOT NULL,
	`user_id` text NOT NULL,
	`reaction_type` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`comment_id`, `user_id`, `reaction_type`),
	FOREIGN KEY (`comment_id`) REFERENCES `post_comment`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `comment_reaction_commentId_idx` ON `comment_reaction` (`comment_id`);--> statement-breakpoint
ALTER TABLE `post_comment` ADD `parent_comment_id` text REFERENCES `post_comment`(`id`) ON DELETE cascade;--> statement-breakpoint
ALTER TABLE `post_comment` ADD `replies_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `post_comment` ADD `reactions_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `post_comment_postId_parent_createdAt_idx` ON `post_comment` (`post_id`,`parent_comment_id`,`created_at`,`id`);
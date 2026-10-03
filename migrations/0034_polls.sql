CREATE TABLE `poll` (
	`post_id` text PRIMARY KEY NOT NULL,
	`closes_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `poll_option` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`position` integer NOT NULL,
	`label` text NOT NULL,
	`votes_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `poll`(`post_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `poll_option_postId_position_unique` ON `poll_option` (`post_id`,`position`);--> statement-breakpoint
CREATE TABLE `poll_vote` (
	`post_id` text NOT NULL,
	`user_id` text NOT NULL,
	`option_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`post_id`, `user_id`),
	FOREIGN KEY (`post_id`) REFERENCES `poll`(`post_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`option_id`) REFERENCES `poll_option`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `poll_vote_userId_idx` ON `poll_vote` (`user_id`);--> statement-breakpoint
CREATE INDEX `poll_vote_optionId_idx` ON `poll_vote` (`option_id`);
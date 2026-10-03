CREATE TABLE `story` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`media_url` text NOT NULL,
	`media_type` text NOT NULL,
	`caption` text,
	`location` text,
	`views_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `story_userId_expiresAt_idx` ON `story` (`user_id`,`expires_at`);--> statement-breakpoint
CREATE INDEX `story_expiresAt_idx` ON `story` (`expires_at`);--> statement-breakpoint
CREATE TABLE `story_view` (
	`story_id` text NOT NULL,
	`viewer_id` text NOT NULL,
	`viewed_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`reaction` text,
	PRIMARY KEY(`story_id`, `viewer_id`),
	FOREIGN KEY (`story_id`) REFERENCES `story`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`viewer_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `story_view_storyId_viewedAt_idx` ON `story_view` (`story_id`,`viewed_at`,`viewer_id`);--> statement-breakpoint
CREATE INDEX `story_view_viewerId_idx` ON `story_view` (`viewer_id`);
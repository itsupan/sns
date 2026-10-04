CREATE TABLE `story_highlight` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`cover_story_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cover_story_id`) REFERENCES `story`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `story_highlight_userId_createdAt_idx` ON `story_highlight` (`user_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `story_highlight_coverStoryId_idx` ON `story_highlight` (`cover_story_id`);--> statement-breakpoint
CREATE TABLE `story_highlight_item` (
	`highlight_id` text NOT NULL,
	`story_id` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`highlight_id`, `story_id`),
	FOREIGN KEY (`highlight_id`) REFERENCES `story_highlight`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`story_id`) REFERENCES `story`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `story_highlight_item_highlightId_position_idx` ON `story_highlight_item` (`highlight_id`,`position`);--> statement-breakpoint
CREATE INDEX `story_highlight_item_storyId_idx` ON `story_highlight_item` (`story_id`);--> statement-breakpoint
CREATE INDEX `story_userId_createdAt_idx` ON `story` (`user_id`,`created_at`,`id`);
CREATE TABLE `post_draft` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`payload` text NOT NULL,
	`publish_at` integer,
	`last_error` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `post_draft_userId_updatedAt_idx` ON `post_draft` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `post_draft_publishAt_idx` ON `post_draft` (`publish_at`);--> statement-breakpoint
CREATE INDEX `post_media_url_idx` ON `post_media` (`url`);
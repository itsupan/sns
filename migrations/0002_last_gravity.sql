CREATE TABLE `post` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text,
	`content` text NOT NULL,
	`media_url` text,
	`media_type` text DEFAULT 'none' NOT NULL,
	`camera_meta` text,
	`tags` text,
	`post_type` text DEFAULT 'photo' NOT NULL,
	`likes_count` integer DEFAULT 0 NOT NULL,
	`comments_count` integer DEFAULT 0 NOT NULL,
	`shares_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `post_userId_idx` ON `post` (`user_id`);--> statement-breakpoint
CREATE INDEX `post_createdAt_idx` ON `post` (`created_at`);--> statement-breakpoint
CREATE TABLE `post_comment` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`user_id` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `post_comment_postId_idx` ON `post_comment` (`post_id`);--> statement-breakpoint
CREATE INDEX `post_comment_userId_idx` ON `post_comment` (`user_id`);--> statement-breakpoint
CREATE INDEX `post_comment_createdAt_idx` ON `post_comment` (`created_at`);--> statement-breakpoint
CREATE TABLE `post_like` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `post_like_postId_userId_unique` ON `post_like` (`post_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `post_like_userId_idx` ON `post_like` (`user_id`);--> statement-breakpoint
CREATE INDEX `post_like_postId_idx` ON `post_like` (`post_id`);
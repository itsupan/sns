ALTER TABLE `post` ADD `repost_of_id` text REFERENCES `post`(`id`) ON DELETE cascade;--> statement-breakpoint
ALTER TABLE `post` ADD `quote_of_id` text REFERENCES `post`(`id`) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `post` ADD `reposts_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `post_userId_repostOfId_unique` ON `post` (`user_id`,`repost_of_id`) WHERE repost_of_id is not null and deleted_at is null;--> statement-breakpoint
CREATE INDEX `post_repostOfId_idx` ON `post` (`repost_of_id`);--> statement-breakpoint
CREATE INDEX `post_quoteOfId_idx` ON `post` (`quote_of_id`);
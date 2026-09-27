DROP INDEX `post_userId_idx`;--> statement-breakpoint
DROP INDEX `post_createdAt_idx`;--> statement-breakpoint
ALTER TABLE `post` ADD `deleted_at` integer;--> statement-breakpoint
CREATE INDEX `post_createdAt_id_idx` ON `post` (`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `post_userId_createdAt_idx` ON `post` (`user_id`,`created_at`);
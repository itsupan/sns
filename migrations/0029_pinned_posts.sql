ALTER TABLE `post` ADD `pinned_at` integer;--> statement-breakpoint
CREATE INDEX `post_userId_pinnedAt_idx` ON `post` (`user_id`,`pinned_at`);
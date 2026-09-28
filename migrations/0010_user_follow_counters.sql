DROP INDEX `user_follow_followingId_idx`;--> statement-breakpoint
CREATE INDEX `user_follow_followingId_createdAt_idx` ON `user_follow` (`following_id`,`created_at`,`follower_id`);--> statement-breakpoint
CREATE INDEX `user_follow_followerId_createdAt_idx` ON `user_follow` (`follower_id`,`created_at`,`following_id`);--> statement-breakpoint
ALTER TABLE `user` ADD `followers_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `following_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Backfill counters from existing follow rows (same values followersCountOf / followingCountOf compute).
UPDATE `user` SET
	`followers_count` = (SELECT count(*) FROM `user_follow` f WHERE f.`following_id` = `user`.`id`),
	`following_count` = (SELECT count(*) FROM `user_follow` f WHERE f.`follower_id` = `user`.`id`);

ALTER TABLE `user` ADD `onboarded_at` integer;
--> statement-breakpoint
-- Accounts from before the welcome flow existed are already set up.
UPDATE `user` SET `onboarded_at` = `created_at`;

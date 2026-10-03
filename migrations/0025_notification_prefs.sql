CREATE TABLE `notification_opt_out` (
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`user_id`, `type`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);

--> statement-breakpoint
-- Notification types the recipient turned off are silently skipped, so every action that notifies
-- respects the preference in one place.
CREATE TRIGGER `notification_opt_out_guard` BEFORE INSERT ON `notification`
WHEN EXISTS (
	SELECT 1 FROM `notification_opt_out`
	WHERE `user_id` = new.`recipient_id` AND `type` = new.`type`
)
BEGIN
	SELECT RAISE(IGNORE);
END;

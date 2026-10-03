CREATE TABLE `moderation_action` (
	`id` text PRIMARY KEY NOT NULL,
	`moderator_id` text,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`report_id` text,
	`note` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`moderator_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`report_id`) REFERENCES `report`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `moderation_action_moderatorId_idx` ON `moderation_action` (`moderator_id`);--> statement-breakpoint
CREATE INDEX `moderation_action_reportId_idx` ON `moderation_action` (`report_id`);--> statement-breakpoint
ALTER TABLE `report` ADD `resolved_by` text REFERENCES `user`(`id`) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `report` ADD `resolved_at` integer;--> statement-breakpoint
ALTER TABLE `report` ADD `resolution` text;--> statement-breakpoint
CREATE INDEX `report_open_target_createdAt_idx` ON `report` (`target_type`,`target_id`,`created_at`) WHERE status = 'open';--> statement-breakpoint
CREATE INDEX `report_resolvedBy_idx` ON `report` (`resolved_by`);--> statement-breakpoint
ALTER TABLE `session` ADD `impersonated_by` text;--> statement-breakpoint
ALTER TABLE `user` ADD `role` text;--> statement-breakpoint
ALTER TABLE `user` ADD `banned` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `user` ADD `ban_reason` text;--> statement-breakpoint
ALTER TABLE `user` ADD `ban_expires` integer;--> statement-breakpoint
-- The moderator list: WHERE role IN (...).
CREATE INDEX `user_role_idx` ON `user` (`role`);

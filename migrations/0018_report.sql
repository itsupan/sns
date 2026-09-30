CREATE TABLE `report` (
	`id` text PRIMARY KEY NOT NULL,
	`reporter_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`reason` text NOT NULL,
	`details` text,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`reporter_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `report_target_idx` ON `report` (`target_type`,`target_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `report_reporter_target_open_unique` ON `report` (`reporter_id`,`target_type`,`target_id`) WHERE status = 'open';

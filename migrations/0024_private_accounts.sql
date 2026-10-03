CREATE TABLE `follow_request` (
	`requester_id` text NOT NULL,
	`target_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`requester_id`, `target_id`),
	FOREIGN KEY (`requester_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `follow_request_targetId_createdAt_idx` ON `follow_request` (`target_id`,`created_at`,`requester_id`);--> statement-breakpoint
ALTER TABLE `user` ADD `is_private` integer DEFAULT false NOT NULL;
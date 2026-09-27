ALTER TABLE `post` ADD `media_urls` text;--> statement-breakpoint
ALTER TABLE `post` ADD `aspect_ratio` text DEFAULT '1:1';--> statement-breakpoint
ALTER TABLE `post` ADD `location` text;
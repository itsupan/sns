CREATE TABLE `post_media` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`url` text NOT NULL,
	`type` text NOT NULL,
	`width` integer,
	`height` integer,
	`position` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `post_media_postId_position_unique` ON `post_media` (`post_id`,`position`);--> statement-breakpoint
-- Backfill from the JSON media_urls column (invalid JSON is treated as empty).
INSERT INTO `post_media` (`id`, `post_id`, `url`, `type`, `position`)
SELECT
	lower(hex(randomblob(16))),
	p.`id`,
	trim(json_extract(j.value, '$.url')),
	CASE
		WHEN json_extract(j.value, '$.type') = 'video'
			OR lower(json_extract(j.value, '$.url')) GLOB '*.mp4*'
			OR lower(json_extract(j.value, '$.url')) GLOB '*.webm*'
			OR lower(json_extract(j.value, '$.url')) GLOB '*.mov*'
		THEN 'video' ELSE 'image'
	END,
	row_number() OVER (PARTITION BY p.`id` ORDER BY CAST(j.key AS integer)) - 1
FROM `post` p,
	json_each(CASE WHEN json_valid(p.`media_urls`) AND json_type(p.`media_urls`) = 'array' THEN p.`media_urls` ELSE '[]' END) j
WHERE json_type(j.value) = 'object'
	AND trim(coalesce(json_extract(j.value, '$.url'), '')) <> '';
--> statement-breakpoint
-- Fallback: posts with only the single legacy media_url.
INSERT INTO `post_media` (`id`, `post_id`, `url`, `type`, `position`)
SELECT
	lower(hex(randomblob(16))),
	p.`id`,
	trim(p.`media_url`),
	CASE
		WHEN p.`media_type` = 'video'
			OR lower(p.`media_url`) GLOB '*.mp4*'
			OR lower(p.`media_url`) GLOB '*.webm*'
			OR lower(p.`media_url`) GLOB '*.mov*'
		THEN 'video' ELSE 'image'
	END,
	0
FROM `post` p
WHERE trim(coalesce(p.`media_url`, '')) <> ''
	AND NOT EXISTS (SELECT 1 FROM `post_media` m WHERE m.`post_id` = p.`id`);

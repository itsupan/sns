CREATE TABLE `post_tag` (
	`post_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`post_id`, `tag_id`),
	FOREIGN KEY (`post_id`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tag`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `post_tag_tagId_idx` ON `post_tag` (`tag_id`);--> statement-breakpoint
CREATE TABLE `tag` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tag_slug_unique` ON `tag` (`slug`);--> statement-breakpoint
-- Backfill tags from post.tags JSON. Same rules as normalizeTags(): trim, strip leading '#',
-- skip blanks; case variants share one tag whose name is the earliest post's spelling.
WITH raw AS (
	SELECT p.`id` AS post_id, p.`created_at` AS created_at, CAST(j.key AS integer) AS k,
		trim(ltrim(trim(j.value), '#')) AS name
	FROM `post` p,
		json_each(CASE WHEN json_valid(p.`tags`) AND json_type(p.`tags`) = 'array' THEN p.`tags` ELSE '[]' END) j
	WHERE j.type = 'text'
), ranked AS (
	SELECT lower(name) AS slug, name,
		row_number() OVER (PARTITION BY lower(name) ORDER BY created_at, post_id, k) AS rn
	FROM raw
	WHERE name <> ''
)
INSERT INTO `tag` (`id`, `slug`, `name`)
SELECT lower(hex(randomblob(16))), slug, name FROM ranked WHERE rn = 1;
--> statement-breakpoint
-- Link posts to tags in the author's order, dropping duplicates within a post.
WITH raw AS (
	SELECT p.`id` AS post_id, CAST(j.key AS integer) AS k,
		trim(ltrim(trim(j.value), '#')) AS name
	FROM `post` p,
		json_each(CASE WHEN json_valid(p.`tags`) AND json_type(p.`tags`) = 'array' THEN p.`tags` ELSE '[]' END) j
	WHERE j.type = 'text'
), deduped AS (
	SELECT post_id, lower(name) AS slug, k,
		row_number() OVER (PARTITION BY post_id, lower(name) ORDER BY k) AS rn
	FROM raw
	WHERE name <> ''
)
INSERT INTO `post_tag` (`post_id`, `tag_id`, `position`)
SELECT d.post_id, t.`id`, row_number() OVER (PARTITION BY d.post_id ORDER BY d.k) - 1
FROM deduped d
JOIN `tag` t ON t.`slug` = d.slug
WHERE d.rn = 1;

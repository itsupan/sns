import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contractOkReason, findContractChanges, uniqueIndexesAfter } from './migration-safety.mjs';

/** The unique indexes that exist before each migration under test. */
const uniqueIndexes = new Set(['tag_slug_unique']);
const changesOf = (sql: string) =>
	findContractChanges(sql, uniqueIndexes).map(({ change }) => change);

describe('findContractChanges', () => {
	it('allows expand statements, backfills and dropping a plain index', () => {
		const sql = [
			'CREATE TABLE `post_share` (`id` text PRIMARY KEY NOT NULL);--> statement-breakpoint',
			'CREATE UNIQUE INDEX `post_share_unique` ON `post_share` (`id`);--> statement-breakpoint',
			"ALTER TABLE `post` ADD `background` text DEFAULT 'none';--> statement-breakpoint",
			'ALTER TABLE `user` ADD COLUMN `drop` integer;--> statement-breakpoint',
			'DROP INDEX `post_userId_idx`;--> statement-breakpoint',
			'UPDATE `user` SET `followers_count` = 0;',
			'PRAGMA defer_foreign_keys = on;'
		].join('\n');
		expect(changesOf(sql)).toEqual([]);
	});

	it.each([
		['DROP TABLE', 'DROP TABLE `tag`;'],
		['DROP TABLE', 'drop table if exists tag;'],
		['DROP COLUMN', 'ALTER TABLE `post` DROP COLUMN `tags`;'],
		['DROP COLUMN', 'ALTER TABLE main."post" DROP tags;'],
		['RENAME', 'ALTER TABLE `post` RENAME COLUMN `body` TO `content`;'],
		['RENAME', 'ALTER TABLE [post] RENAME TO `posts`;'],
		['PRAGMA foreign_keys', 'PRAGMA foreign_keys=OFF;'],
		['DROP INDEX (unique)', 'DROP INDEX `tag_slug_unique`;'],
		['DROP INDEX (unique)', 'DROP INDEX IF EXISTS main."Tag_Slug_Unique";']
	])('flags %s in %s', (change, sql) => {
		expect(changesOf(sql)).toEqual([change]);
	});

	it('flags every statement of a drizzle table rebuild, with its line', () => {
		const sql = [
			'PRAGMA foreign_keys=OFF;--> statement-breakpoint',
			'CREATE TABLE `__new_post` (',
			'\t`id` text PRIMARY KEY NOT NULL',
			');',
			'--> statement-breakpoint',
			'INSERT INTO `__new_post`("id") SELECT "id" FROM `post`;--> statement-breakpoint',
			'DROP TABLE `post`;--> statement-breakpoint',
			'ALTER TABLE `__new_post` RENAME TO `post`;--> statement-breakpoint',
			'PRAGMA foreign_keys=ON;'
		].join('\n');
		expect(
			findContractChanges(sql, uniqueIndexes).map(({ line, change }) => [line, change])
		).toEqual([
			[1, 'PRAGMA foreign_keys'],
			[2, 'table rebuild'],
			[6, 'table rebuild'],
			[7, 'DROP TABLE'],
			[8, 'table rebuild'],
			[9, 'PRAGMA foreign_keys']
		]);
	});

	it('ignores keywords inside comments and string literals', () => {
		const sql = [
			'-- Rebuilding `post` (a `__new_*` copy) would DROP TABLE post; never do that.',
			'/* ALTER TABLE `post` DROP COLUMN `tags`; */',
			"INSERT INTO `note` (`body`) VALUES ('it''s fine; DROP TABLE `user`');",
			'CREATE TABLE `x--y` (`id` text);'
		].join('\n');
		expect(changesOf(sql)).toEqual([]);
	});

	it('flags only the 0006 and 0008 contract steps among the existing migrations', async () => {
		const dir = join(process.cwd(), 'migrations');
		const files = (await readdir(dir)).filter((file) => file.endsWith('.sql')).sort();
		const sources = await Promise.all(files.map((file) => readFile(join(dir, file), 'utf8')));
		const flagged = files.filter(
			(_, i) => findContractChanges(sources[i], uniqueIndexesAfter(sources.slice(0, i))).length > 0
		);
		expect(flagged).toEqual([
			'0006_drop_legacy_media_columns.sql',
			'0008_drop_post_tags_column.sql'
		]);
	});
});

describe('uniqueIndexesAfter', () => {
	it('follows unique indexes as migrations create and drop them', () => {
		const migrations = [
			'CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);\nCREATE INDEX `post_idx` ON `post` (`id`);',
			'CREATE UNIQUE INDEX IF NOT EXISTS "Tag_Slug_Unique" ON `tag` (`slug`);',
			'DROP INDEX `user_email_unique`;'
		];
		expect(uniqueIndexesAfter(migrations)).toEqual(new Set(['tag_slug_unique']));
	});
});

describe('contractOkReason', () => {
	it('reads the reason from a contract-ok line', () => {
		const sql =
			'-- contract-ok: media columns unused since #32\nALTER TABLE `post` DROP `media_url`;';
		expect(contractOkReason(sql)).toBe('media columns unused since #32');
	});

	it('requires a reason on a line of its own', () => {
		expect(contractOkReason('-- contract-ok:\nDROP TABLE `tag`;')).toBeUndefined();
		expect(contractOkReason('DROP TABLE `tag`; -- contract-ok: unused')).toBeUndefined();
		expect(contractOkReason('DROP TABLE `tag`;')).toBeUndefined();
	});
});

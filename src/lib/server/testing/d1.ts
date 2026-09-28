import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/d1';
import { getPlatformProxy } from 'wrangler';
import * as schema from '$lib/server/db/schema';

/**
 * Per-test timeout for specs that use a real D1. Concurrency tests take ~1s alone but can exceed
 * Vitest's 5s default when the full suite (incl. browser tests) competes for CPU.
 */
export const REAL_D1_TIMEOUT = 30_000;

const MIGRATIONS_DIR = join(process.cwd(), 'migrations');

async function applyMigrations(d1: D1Database, files: string[]) {
	for (const file of files) {
		const statements = (await readFile(join(MIGRATIONS_DIR, file), 'utf8'))
			.split('--> statement-breakpoint')
			.map((s) => s.trim())
			.filter(Boolean);
		await d1.batch(statements.map((s) => d1.prepare(s)));
	}
}

/**
 * Starts an in-memory local D1 (real SQLite in workerd) with migrations applied.
 * Use for tests that must prove SQL behaviour, e.g. counters under concurrency.
 *
 * `stopBefore: '0005'` applies only earlier migrations so a test can insert legacy data;
 * then call `migrateRest()` to run the remaining ones (e.g. to test a backfill).
 */
export async function createTestDb(options: { stopBefore?: string } = {}) {
	const proxy = await getPlatformProxy<Env>({ persist: false });
	const d1 = proxy.env.DB;

	const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
	const cut = options.stopBefore
		? files.findIndex((f) => f.startsWith(options.stopBefore!))
		: files.length;
	if (cut === -1) throw new Error(`No migration starting with ${options.stopBefore}`);
	await applyMigrations(d1, files.slice(0, cut));

	return {
		db: drizzle(d1, { schema }),
		d1,
		migrateRest: () => applyMigrations(d1, files.slice(cut)),
		dispose: () => proxy.dispose()
	};
}

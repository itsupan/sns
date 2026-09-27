import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/d1';
import { getPlatformProxy } from 'wrangler';
import * as schema from '$lib/server/db/schema';

/**
 * Starts an in-memory local D1 (real SQLite in workerd) with all migrations applied.
 * Use for tests that must prove SQL behaviour, e.g. counters under concurrency.
 */
export async function createTestDb() {
	const proxy = await getPlatformProxy<Env>({ persist: false });
	const d1 = proxy.env.DB;

	const dir = join(process.cwd(), 'migrations');
	const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
	for (const file of files) {
		const statements = (await readFile(join(dir, file), 'utf8'))
			.split('--> statement-breakpoint')
			.map((s) => s.trim())
			.filter(Boolean);
		await d1.batch(statements.map((s) => d1.prepare(s)));
	}

	return { db: drizzle(d1, { schema }), dispose: () => proxy.dispose() };
}

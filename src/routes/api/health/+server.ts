import { sql } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Smoke endpoint: proves the Worker is up AND that its D1 binding answers queries.
 * Used by the end-to-end tests and safe to point an uptime check at.
 */
export const GET: RequestHandler = async ({ locals }) => {
	try {
		await locals.db.run(sql`select 1`);

		return json({ status: 'ok', database: 'ok' });
	} catch (error) {
		return json(
			{
				status: 'degraded',
				database: 'unreachable',
				error: error instanceof Error ? error.message : String(error)
			},
			{ status: 503 }
		);
	}
};

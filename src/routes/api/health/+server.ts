import { sql } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Smoke endpoint: proves the Worker is up AND that its D1 and KV bindings answer.
 * Used by the end-to-end tests and safe to point an uptime check at.
 */
export const GET: RequestHandler = async ({ locals, platform }) => {
	try {
		await locals.db.run(sql`select 1`);
		await platform!.env.KV.get('health');

		return json({ status: 'ok', database: 'ok', kv: 'ok' });
	} catch (error) {
		return json(
			{
				status: 'degraded',
				error: error instanceof Error ? error.message : String(error)
			},
			{ status: 503 }
		);
	}
};

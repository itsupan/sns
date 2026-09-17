import { sql } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

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

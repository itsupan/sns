import type { RequestHandler } from './$types';
import { buildAccountExport } from '$lib/server/db/account';
import { ApiError, enforceRateLimit, requireUser, withApi } from '$lib/server/api';

/** "Download my data": the signed-in user's full data as a JSON attachment. */
export const GET: RequestHandler = withApi(async ({ locals, platform }) => {
	const me = requireUser(locals);
	await enforceRateLimit(platform, 'accountExport', me.id);

	const data = await buildAccountExport(locals.db, me.id);
	if (!data) throw new ApiError(404, 'not_found', 'Account not found');

	const day = data.exportedAt.slice(0, 10);
	return new Response(JSON.stringify(data, null, 2), {
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'content-disposition': `attachment; filename="kizuna-data-${day}.json"`,
			'cache-control': 'no-store'
		}
	});
});

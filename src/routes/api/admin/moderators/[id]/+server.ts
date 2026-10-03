import type { RequestHandler } from './$types';
import { enforceRateLimit, requireAdmin, withApi } from '$lib/server/api';
import { requireUserByIdOrHandle, setModerator } from '$lib/server/db/moderation';

/** Takes the moderator role away (back to `user`). Admins only. */
export const DELETE: RequestHandler = withApi(async ({ params, locals, platform }) => {
	const admin = requireAdmin(locals);
	await enforceRateLimit(platform, 'moderation', admin.id);
	const target = await requireUserByIdOrHandle(locals.db, params.id);
	await setModerator(locals.db, { admin, target, grant: false });
	return new Response(null, { status: 204 });
});

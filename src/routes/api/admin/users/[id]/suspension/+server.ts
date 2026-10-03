import * as v from 'valibot';
import type { RequestHandler } from './$types';
import { enforceRateLimit, parseBody, requireAdmin, withApi } from '$lib/server/api';
import { ModerationNote } from '$lib/server/api/moderation';
import { requireUserByIdOrHandle, unsuspendUser } from '$lib/server/db/moderation';

/** Lifts a user's suspension. Admins only. Optional body: `note`. */
export const DELETE: RequestHandler = withApi(async ({ params, request, locals, platform }) => {
	const admin = requireAdmin(locals);
	await enforceRateLimit(platform, 'moderation', admin.id);
	const { note } = await parseBody(request, v.object({ note: ModerationNote }));
	const target = await requireUserByIdOrHandle(locals.db, params.id);
	await unsuspendUser(locals.db, { admin, target, note: note || null });
	return new Response(null, { status: 204 });
});

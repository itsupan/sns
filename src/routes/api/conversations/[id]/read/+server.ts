import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { enforceRateLimit, requireUser, withApi } from '$lib/server/api';
import { markRead, requireMembership } from '$lib/server/db/chat';

/** Marks the conversation read up to its latest message. */
export const POST: RequestHandler = withApi(async ({ params, locals, platform }) => {
	const viewer = requireUser(locals);
	await enforceRateLimit(platform, 'markRead', viewer.id);
	await requireMembership(locals.db, params.id, viewer.id);
	await markRead(locals.db, params.id, viewer.id);
	return json({ ok: true });
});

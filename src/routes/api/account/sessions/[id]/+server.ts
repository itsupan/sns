import { and, eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { session } from '$lib/server/db/auth-schema';
import { enforceRateLimit, requireUser, withApi } from '$lib/server/api';

/**
 * Signs out `:id`, one of the caller's own sessions. Settings lists sessions by id, so their tokens
 * never reach the browser. Idempotent: a session that is gone, or not the caller's, is left as is.
 */
export const DELETE: RequestHandler = withApi(async ({ params, locals, platform }) => {
	const me = requireUser(locals);
	await enforceRateLimit(platform, 'sessionRevoke', me.id);
	await locals.db.delete(session).where(and(eq(session.id, params.id), eq(session.userId, me.id)));
	return new Response(null, { status: 204 });
});

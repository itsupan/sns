import { and, eq, isNull } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { user } from '$lib/server/db/schema';
import { enforceRateLimit, requireUser, withApi } from '$lib/server/api';

/** Marks the first-run welcome flow as done, so page visits stop going to /welcome. */
export const POST: RequestHandler = withApi(async ({ locals, platform }) => {
	const me = requireUser(locals);
	await enforceRateLimit(platform, 'profileUpdate', me.id);
	await locals.db
		.update(user)
		.set({ onboardedAt: new Date() })
		.where(and(eq(user.id, me.id), isNull(user.onboardedAt)));
	return new Response(null, { status: 204 });
});

import { json } from '@sveltejs/kit';
import * as v from 'valibot';
import type { RequestHandler } from './$types';
import { enforceRateLimit, parseQuery, requireUser, withApi } from '$lib/server/api';
import { isHandleTaken } from '$lib/server/db/handles';
import { HANDLE_PATTERN, HANDLE_RULES, normalizeHandle } from '$lib/utils/handle';

const AvailabilityQuery = v.object({
	handle: v.pipe(
		v.string('Handle is required'),
		v.maxLength(64, HANDLE_RULES),
		v.transform(normalizeHandle),
		v.regex(HANDLE_PATTERN, HANDLE_RULES)
	)
});

/**
 * Whether the signed-in user can take `handle` (a leading `@` is ignored); their own current
 * handle counts as available.
 */
export const GET: RequestHandler = withApi(async ({ url, locals, platform }) => {
	const me = requireUser(locals);
	await enforceRateLimit(platform, 'search', me.id);
	const { handle } = await parseQuery(url, AvailabilityQuery);
	return json({ handle, available: !(await isHandleTaken(locals.db, handle, me.id)) });
});

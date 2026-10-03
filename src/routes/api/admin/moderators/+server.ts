import { json } from '@sveltejs/kit';
import * as v from 'valibot';
import type { RequestHandler } from './$types';
import {
	enforceRateLimit,
	parseBody,
	parsePageQuery,
	requireAdmin,
	withApi
} from '$lib/server/api';
import { getConfig } from '$lib/server/config';
import { withFreshAvatar } from '$lib/server/api/moderation';
import { listStaff, requireUserByIdOrHandle, setModerator } from '$lib/server/db/moderation';

const Grant = v.object({
	user: v.pipe(v.string('User is required'), v.trim(), v.minLength(1, 'User is required'))
});

/** Moderators and admins, newest first. Admins only. Query: `limit`, `cursor`. */
export const GET: RequestHandler = withApi(async ({ url, locals, platform }) => {
	const admin = requireAdmin(locals);
	await enforceRateLimit(platform, 'moderation', admin.id);
	const page = await parsePageQuery(url, getConfig(platform?.env).moderation);
	const { users, nextCursor } = await listStaff(locals.db, page);
	return json({
		users: await Promise.all(users.map((u) => withFreshAvatar(u, platform?.env))),
		nextCursor
	});
});

/** Makes a user a moderator. Admins only. Body: `user`, an id or handle. */
export const POST: RequestHandler = withApi(async ({ request, locals, platform }) => {
	const admin = requireAdmin(locals);
	await enforceRateLimit(platform, 'moderation', admin.id);
	const body = await parseBody(request, Grant);
	const target = await requireUserByIdOrHandle(locals.db, body.user);
	await setModerator(locals.db, { admin, target, grant: true });
	return json({ user: { ...target, role: 'moderator' } }, { status: 201 });
});

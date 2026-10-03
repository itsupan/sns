import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getConfig } from '$lib/server/config';
import { withFreshAvatar } from '$lib/server/api/moderation';
import { listStaff } from '$lib/server/db/moderation';

export const load: PageServerLoad = async ({ locals, platform, parent }) => {
	if (!(await parent()).isAdmin) throw error(404, 'Not found');
	const { users, nextCursor } = await listStaff(locals.db, {
		limit: getConfig(platform?.env).moderation.defaultPageSize
	});
	return {
		users: await Promise.all(users.map((u) => withFreshAvatar(u, platform?.env))),
		nextCursor
	};
};

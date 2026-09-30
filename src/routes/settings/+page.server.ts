import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import type { PageServerLoad } from './$types';
import { listBlockedUsers } from '$lib/server/db/blocks';
import { refreshMediaUrl } from '$lib/server/services/storage';
import { displayHandle } from '$lib/utils/format';

export const load: PageServerLoad = async ({ locals, url, platform }) => {
	if (!locals.user) {
		throw redirect(302, `${resolve('/login')}?redirectTo=${encodeURIComponent(url.pathname)}`);
	}
	// The list is secondary: a failure here must not take the settings page down.
	const blocked = locals.db
		? await listBlockedUsers(locals.db, locals.user.id).catch((err) => {
				console.error('Failed to load blocked users:', err);
				return [];
			})
		: [];
	const blockedUsers = await Promise.all(
		blocked.map(async (u) => ({
			id: u.id,
			name: u.name,
			handle: displayHandle(u.handle, u.name),
			image: u.image ? await refreshMediaUrl(u.image, platform?.env) : null
		}))
	);
	return { email: locals.user.email, blockedUsers };
};

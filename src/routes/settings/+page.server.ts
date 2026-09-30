import { redirect } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { account } from '$lib/server/db/auth-schema';
import { resolve } from '$app/paths';
import type { PageServerLoad } from './$types';
import { listBlockedUsers } from '$lib/server/db/blocks';
import { refreshMediaUrl } from '$lib/server/services/storage';
import { displayHandle } from '$lib/utils/format';

export const load: PageServerLoad = async ({ locals, url, platform }) => {
	if (!locals.user) {
		throw redirect(302, `${resolve('/login')}?redirectTo=${encodeURIComponent(url.pathname)}`);
	}
	// Email/password accounts must re-enter their password to delete the account.
	const [credential] = await locals.db
		.select({ id: account.id })
		.from(account)
		.where(and(eq(account.userId, locals.user.id), eq(account.providerId, 'credential')))
		.limit(1);
	// The list is secondary: a failure here must not take the settings page down.
	const blocked = await listBlockedUsers(locals.db, locals.user.id).catch((err) => {
		console.error('Failed to load blocked users:', err);
		return [];
	});
	const blockedUsers = await Promise.all(
		blocked.map(async (u) => ({
			id: u.id,
			name: u.name,
			handle: displayHandle(u.handle, u.name),
			image: u.image ? await refreshMediaUrl(u.image, platform?.env) : null
		}))
	);
	return { email: locals.user.email, hasPassword: Boolean(credential), blockedUsers };
};

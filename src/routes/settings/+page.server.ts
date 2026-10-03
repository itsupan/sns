import { redirect } from '@sveltejs/kit';
import { and, desc, eq, gt } from 'drizzle-orm';
import { account, session } from '$lib/server/db/auth-schema';
import { resolve } from '$app/paths';
import type { PageServerLoad } from './$types';
import { listBlockedUsers } from '$lib/server/db/blocks';
import { refreshMediaUrl } from '$lib/server/services/storage';
import { displayHandle } from '$lib/utils/format';
import { describeUserAgent } from '$lib/utils/user-agent';
import { isModerator } from '$lib/server/roles';

export const load: PageServerLoad = async ({ locals, url, platform }) => {
	if (!locals.user || !locals.session) {
		// The query carries email-link results (e.g. `?verified=1`) through the sign-in.
		throw redirect(
			302,
			`${resolve('/login')}?redirectTo=${encodeURIComponent(url.pathname + url.search)}`
		);
	}
	const me = locals.user;
	const currentSessionId = locals.session.id;
	const [accounts, sessions] = await Promise.all([
		locals.db
			.select({ providerId: account.providerId })
			.from(account)
			.where(eq(account.userId, me.id)),
		locals.db
			.select({
				id: session.id,
				userAgent: session.userAgent,
				createdAt: session.createdAt,
				updatedAt: session.updatedAt
			})
			.from(session)
			.where(and(eq(session.userId, me.id), gt(session.expiresAt, new Date())))
			.orderBy(desc(session.updatedAt))
	]);
	const providers = accounts.map((a) => a.providerId);
	// The list is secondary: a failure here must not take the settings page down.
	const blocked = await listBlockedUsers(locals.db, me.id).catch((err) => {
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
	return {
		email: me.email,
		emailVerified: me.emailVerified,
		// Email/password accounts must re-enter their password to change it or delete the account.
		hasPassword: providers.includes('credential'),
		socialProviders: providers.filter((id) => id !== 'credential'),
		sessions: sessions.map((s) => ({
			id: s.id,
			device: describeUserAgent(s.userAgent),
			createdAt: s.createdAt,
			lastActiveAt: s.updatedAt,
			current: s.id === currentSessionId
		})),
		blockedUsers,
		isModerator: isModerator(me)
	};
};

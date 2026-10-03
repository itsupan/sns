import type { Database } from '$lib/server/db';
import type { FeedCursor } from '$lib/server/db/posts';
import { loadPostMedia } from '$lib/server/db/posts';
import { listNotifications } from '$lib/server/db/notifications';
import { listFollowRequests } from '$lib/server/db/follows';
import { refreshMediaUrl } from '$lib/server/services/storage';
import { displayHandle } from '$lib/utils/format';
import type { ActivityPage, FollowRequestPage } from '$lib/activity/types';

/** A page of Activity with post thumbnails and fresh media URLs, ready for the client. */
export async function loadActivityPage(
	db: Database,
	userId: string,
	page: { limit: number; cursor?: FeedCursor | null },
	env: Partial<Env> | undefined
): Promise<ActivityPage> {
	const { items, nextCursor } = await listNotifications(db, userId, page);
	const postIds = [...new Set(items.flatMap((n) => (n.postId ? [n.postId] : [])))];
	const media = await loadPostMedia(db, postIds);

	// Sign each distinct URL once, however many notifications share it.
	const signed = new Map<string, Promise<string>>();
	const fresh = (url: string | null | undefined) => {
		if (!url) return Promise.resolve(null);
		if (!signed.has(url)) signed.set(url, refreshMediaUrl(url, env));
		return signed.get(url)!;
	};

	return {
		items: await Promise.all(
			items.map(async (n) => {
				const first = n.postId ? media.get(n.postId)?.find((m) => m.type === 'image') : undefined;
				return {
					id: n.id,
					type: n.type,
					createdAt: n.createdAt.getTime(),
					unread: n.unread,
					actor: {
						id: n.actor.id,
						name: n.actor.name,
						handle: displayHandle(n.actor.handle, n.actor.name),
						slug: n.actor.handle?.replace(/^@/, '') || n.actor.id,
						image: await fresh(n.actor.image)
					},
					post: n.postId ? { id: n.postId, thumbnail: await fresh(first?.url) } : null,
					comment: n.comment
				};
			})
		),
		nextCursor
	};
}

/** A page of the user's pending follow requests with fresh avatar URLs. */
export async function loadFollowRequestsPage(
	db: Database,
	userId: string,
	page: { limit: number; cursor?: FeedCursor | null },
	env: Partial<Env> | undefined
): Promise<FollowRequestPage> {
	const { users, nextCursor } = await listFollowRequests(db, userId, page);
	return {
		users: await Promise.all(
			users.map(async (u) => ({
				...u,
				image: u.image ? await refreshMediaUrl(u.image, env) : null
			}))
		),
		nextCursor
	};
}

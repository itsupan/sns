import { aliasedTable, and, asc, eq, inArray, sql } from 'drizzle-orm';
import { resolve } from '$app/paths';
import type { Database } from '$lib/server/db';
import { pushTargetColumns, type PushTarget } from '$lib/server/db/push';
import { jobState, notification, post, pushSubscription, user } from '$lib/server/db/schema';
import type { FeedCursor } from '$lib/server/db/posts';
import { activityVerb } from '$lib/activity/group';
import type { PushPayload } from '$lib/push';
import { deliverPushes, pushEnabled, type PushDelivery } from './send';

/** `job_state` row holding the last notification handled, as JSON `{ createdAt, id }`. */
const JOB = 'push-notifications';

/** Notifications one run handles; any others wait for the next minute. */
const PUSH_BATCH = 200;

/** Older notifications are skipped rather than pushed late, e.g. after push was turned off. */
const MAX_PUSH_AGE_MS = 60 * 60 * 1000;

const afterCursor = ({ createdAt, id }: FeedCursor) =>
	sql`(${notification.createdAt}, ${notification.id}) > (${createdAt}, ${id})`;

type NotificationRow = Awaited<ReturnType<typeof newNotifications>>[number];

function newNotifications(db: Database, after: FeedCursor) {
	const actor = aliasedTable(user, 'actor');
	return db
		.select({
			id: notification.id,
			createdAt: notification.createdAt,
			type: notification.type,
			recipientId: notification.recipientId,
			postId: notification.postId,
			commentId: notification.commentId,
			postDeletedAt: post.deletedAt,
			actor: { id: actor.id, name: actor.name, handle: actor.handle }
		})
		.from(notification)
		.innerJoin(actor, eq(actor.id, notification.actorId))
		.leftJoin(post, eq(post.id, notification.postId))
		.where(afterCursor(after))
		.orderBy(asc(notification.createdAt), asc(notification.id))
		.limit(PUSH_BATCH);
}

/** The post it is about, else the profile of who followed or accepted, else Activity. */
function urlFor(n: NotificationRow): string {
	if (n.postId) return resolve('/post/[id]', { id: n.postId });
	if (n.type === 'follow' || n.type === 'follow_accepted') {
		return resolve('/profile/[id]', { id: n.actor.handle?.replace(/^@/, '') || n.actor.id });
	}
	return resolve('/activity');
}

function payload(n: NotificationRow): PushPayload {
	return {
		title: 'Kizuna',
		body: `${n.actor.name} ${activityVerb(n)}`,
		url: urlFor(n),
		// Likes of one post, reactions to one comment, a person's follow: each replaces the last.
		tag: `${n.type}:${n.postId ?? n.commentId ?? n.actor.id}`
	};
}

/**
 * Every-minute cron: pushes the notifications created since the last run to their recipients'
 * devices, oldest first, then moves the cursor past them. Opt-outs, mutes and blocks need no check
 * here: those notifications are never stored. The first run starts from now.
 */
export async function pushNewNotifications(
	db: Database,
	env: Partial<Env> | undefined,
	now = Date.now()
): Promise<{ notifications: number; deliveries: number }> {
	if (!pushEnabled(env)) return { notifications: 0, deliveries: 0 };

	const [state] = await db
		.select({ value: jobState.value })
		.from(jobState)
		.where(eq(jobState.name, JOB));
	const saved: FeedCursor = state ? JSON.parse(state.value) : { createdAt: now, id: '' };
	const oldest = now - MAX_PUSH_AGE_MS;
	const after = saved.createdAt < oldest ? { createdAt: oldest, id: '' } : saved;

	const rows = await newNotifications(db, after);
	const last = rows.at(-1);
	const cursor: FeedCursor = last ? { createdAt: last.createdAt.getTime(), id: last.id } : after;

	const targets: PushTarget[] = last
		? await db
				.select(pushTargetColumns)
				.from(pushSubscription)
				.where(
					inArray(
						pushSubscription.userId,
						db
							.selectDistinct({ id: notification.recipientId })
							.from(notification)
							.where(
								and(
									afterCursor(after),
									sql`(${notification.createdAt}, ${notification.id}) <= (${cursor.createdAt}, ${cursor.id})`
								)
							)
					)
				)
		: [];

	const deliveries: PushDelivery[] = rows
		.filter((n) => !n.postDeletedAt)
		.flatMap((n) =>
			targets
				.filter((t) => t.userId === n.recipientId)
				.map((subscription) => ({ subscription, payload: payload(n), urgency: 'normal' as const }))
		);
	await deliverPushes(db, env, deliveries);

	if (last || !state) {
		const value = JSON.stringify(cursor);
		const updatedAt = new Date();
		await db
			.insert(jobState)
			.values({ name: JOB, value, updatedAt })
			.onConflictDoUpdate({ target: jobState.name, set: { value, updatedAt } });
	}
	return { notifications: rows.length, deliveries: deliveries.length };
}

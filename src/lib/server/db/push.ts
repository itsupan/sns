import { and, desc, eq, notInArray } from 'drizzle-orm';
import type { Database } from '.';
import { pushSubscription } from './schema';

/** Devices one user receives pushes on; subscribing another drops the oldest. */
export const MAX_PUSH_SUBSCRIPTIONS = 10;

/** A browser's subscription as `PushSubscription.toJSON()` gives it, flattened. */
export interface PushSubscriptionInput {
	endpoint: string;
	p256dh: string;
	auth: string;
}

/** What sending to a subscription needs. */
export type PushTarget = Pick<
	typeof pushSubscription.$inferSelect,
	'id' | 'userId' | 'endpoint' | 'p256dh' | 'auth'
>;

export const pushTargetColumns = {
	id: pushSubscription.id,
	userId: pushSubscription.userId,
	endpoint: pushSubscription.endpoint,
	p256dh: pushSubscription.p256dh,
	auth: pushSubscription.auth
};

/**
 * Stores the browser's subscription for `userId`. Its endpoint may already belong to someone who
 * used this browser before; the newest subscriber takes it over with fresh keys.
 */
export async function savePushSubscription(
	db: Database,
	userId: string,
	{ endpoint, p256dh, auth }: PushSubscriptionInput
): Promise<void> {
	const now = new Date();
	await db.batch([
		db
			.insert(pushSubscription)
			.values({ id: crypto.randomUUID(), userId, endpoint, p256dh, auth, createdAt: now })
			.onConflictDoUpdate({
				target: pushSubscription.endpoint,
				set: { userId, p256dh, auth, createdAt: now, lastSuccessAt: null }
			}),
		db
			.delete(pushSubscription)
			.where(
				and(
					eq(pushSubscription.userId, userId),
					notInArray(
						pushSubscription.id,
						db
							.select({ id: pushSubscription.id })
							.from(pushSubscription)
							.where(eq(pushSubscription.userId, userId))
							.orderBy(desc(pushSubscription.createdAt))
							.limit(MAX_PUSH_SUBSCRIPTIONS)
					)
				)
			)
	]);
}

/** Removes the user's subscription for `endpoint`; someone else's is left alone. */
export async function deletePushSubscription(
	db: Database,
	userId: string,
	endpoint: string
): Promise<void> {
	await db
		.delete(pushSubscription)
		.where(and(eq(pushSubscription.userId, userId), eq(pushSubscription.endpoint, endpoint)));
}

export async function pushTargetsOf(db: Database, userId: string): Promise<PushTarget[]> {
	return db
		.select(pushTargetColumns)
		.from(pushSubscription)
		.where(eq(pushSubscription.userId, userId));
}

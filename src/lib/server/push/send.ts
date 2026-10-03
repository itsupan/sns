import { buildPushHTTPRequest } from '@pushforge/builder';
import { eq } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import type { Database } from '$lib/server/db';
import type { PushTarget } from '$lib/server/db/push';
import { pushSubscription } from '$lib/server/db/schema';
import { getConfig } from '$lib/server/config';
import type { PushPayload } from '$lib/push';

export interface PushDelivery {
	subscription: PushTarget;
	payload: PushPayload;
	/** Battery hint for the push service: `high` wakes the device for a direct message. */
	urgency: 'normal' | 'high';
}

/** A push service's answer for a subscription that is gone for good (RFC 8030 §7.3). */
const GONE_STATUSES = new Set([404, 410]);

/** Whether Web Push is configured (VAPID keys and subject); see config. */
export function pushEnabled(env: Partial<Env> | undefined): boolean {
	return getConfig(env).webPush !== null;
}

/**
 * Encrypts each payload for its subscription (RFC 8291, signed with VAPID per RFC 8292) and posts
 * it to the push service. Afterwards drops the subscriptions their service no longer knows and
 * stamps the ones that accepted. Failures are logged, never thrown. No-op while push is off.
 */
export async function deliverPushes(
	db: Database,
	env: Partial<Env> | undefined,
	deliveries: PushDelivery[]
): Promise<void> {
	const webPush = getConfig(env).webPush;
	const privateJWK = env?.VAPID_PRIVATE_KEY;
	if (!webPush || !privateJWK || !deliveries.length) return;

	const results = await Promise.allSettled(
		deliveries.map(async ({ subscription, payload, urgency }) => {
			const { endpoint, headers, body } = await buildPushHTTPRequest({
				privateJWK,
				subscription: {
					endpoint: subscription.endpoint,
					keys: { p256dh: subscription.p256dh, auth: subscription.auth }
				},
				message: { payload, adminContact: webPush.subject, options: { urgency } }
			});
			const res = await fetch(endpoint, { method: 'POST', headers, body });
			return res.status;
		})
	);

	const delivered = new Set<string>();
	const gone = new Set<string>();
	results.forEach((result, i) => {
		const { id, endpoint } = deliveries[i].subscription;
		if (result.status === 'rejected') {
			console.warn('[push] send failed', new URL(endpoint).origin, result.reason);
		} else if (result.value >= 200 && result.value < 300) {
			delivered.add(id);
		} else if (GONE_STATUSES.has(result.value)) {
			gone.add(id);
		} else {
			console.warn('[push] rejected', new URL(endpoint).origin, result.value);
		}
	});

	const now = new Date();
	const statements: BatchItem<'sqlite'>[] = [
		...[...gone].map((id) => db.delete(pushSubscription).where(eq(pushSubscription.id, id))),
		...[...delivered].map((id) =>
			db.update(pushSubscription).set({ lastSuccessAt: now }).where(eq(pushSubscription.id, id))
		)
	];
	if (statements.length) {
		await db.batch(statements as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]);
	}
}

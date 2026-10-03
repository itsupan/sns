import * as v from 'valibot';
import type { RequestHandler } from './$types';
import { ApiError, enforceRateLimit, parseBody, requireUser, withApi } from '$lib/server/api';
import { deletePushSubscription, savePushSubscription } from '$lib/server/db/push';
import { pushEnabled } from '$lib/server/push/send';

const Endpoint = v.pipe(
	v.string('Endpoint is required'),
	v.maxLength(2048, 'Endpoint is too long'),
	v.url('Endpoint must be a URL'),
	v.startsWith('https://', 'Endpoint must use HTTPS')
);

/** `PushSubscription.toJSON()`; other fields (`expirationTime`) are ignored. */
const Subscription = v.object(
	{
		endpoint: Endpoint,
		keys: v.object(
			{
				// An uncompressed P-256 point (65 bytes) and a 16-byte secret, unpadded base64url.
				p256dh: v.pipe(v.string(), v.regex(/^[A-Za-z0-9_-]{87}$/, 'Invalid p256dh key')),
				auth: v.pipe(v.string(), v.regex(/^[A-Za-z0-9_-]{22}$/, 'Invalid auth secret'))
			},
			'Subscription keys are required'
		)
	},
	'Request body must be an object'
);

const Unsubscription = v.object({ endpoint: Endpoint }, 'Request body must be an object');

function requirePush(platform: App.Platform | undefined) {
	if (!pushEnabled(platform?.env)) {
		throw new ApiError(404, 'not_found', 'Push notifications are not available');
	}
}

/** Sends the signed-in user's notifications to this browser too. 204. */
export const POST: RequestHandler = withApi(async ({ request, locals, platform }) => {
	const me = requireUser(locals);
	requirePush(platform);
	await enforceRateLimit(platform, 'pushSubscribe', me.id);
	const { endpoint, keys } = await parseBody(request, Subscription);
	await savePushSubscription(locals.db, me.id, { endpoint, ...keys });
	return new Response(null, { status: 204 });
});

/** Stops pushing to this browser. 204, also when it was not subscribed. */
export const DELETE: RequestHandler = withApi(async ({ request, locals, platform }) => {
	const me = requireUser(locals);
	await enforceRateLimit(platform, 'pushSubscribe', me.id);
	const { endpoint } = await parseBody(request, Unsubscription);
	await deletePushSubscription(locals.db, me.id, endpoint);
	return new Response(null, { status: 204 });
});

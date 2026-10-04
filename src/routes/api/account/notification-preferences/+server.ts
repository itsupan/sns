import { json } from '@sveltejs/kit';
import * as v from 'valibot';
import type { RequestHandler } from './$types';
import { NOTIFICATION_TYPES } from '$lib/server/db/schema';
import {
	getNotificationPreferences,
	setNotificationPreferences
} from '$lib/server/db/notifications';
import { enforceRateLimit, parseBody, requireUser, withApi } from '$lib/server/api';

const PreferenceChanges = v.record(
	v.picklist(NOTIFICATION_TYPES, 'Unknown notification type'),
	v.boolean('Each setting must be true or false')
);

/** Whether each notification type is on for the signed-in user. */
export const GET: RequestHandler = withApi(async ({ locals }) => {
	const me = requireUser(locals);
	return json(await getNotificationPreferences(locals.db, me.id));
});

/** Turns the given notification types on or off; types left out keep their setting. */
export const PUT: RequestHandler = withApi(async ({ locals, platform, request }) => {
	const me = requireUser(locals);
	await enforceRateLimit(platform, 'profileUpdate', me.id);
	const changes = await parseBody(request, PreferenceChanges);
	await setNotificationPreferences(locals.db, me.id, changes);
	return json(await getNotificationPreferences(locals.db, me.id));
});

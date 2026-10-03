import { json } from '@sveltejs/kit';
import * as v from 'valibot';
import type { RequestHandler } from './$types';
import { enforceRateLimit, parseBody, requireModerator, withApi } from '$lib/server/api';
import { ModerationNote } from '$lib/server/api/moderation';
import { REPORT_TARGET_TYPES } from '$lib/server/db/schema';
import { resolveReports } from '$lib/server/db/moderation';
import { MAX_SUSPENSION_DAYS, RESOLVE_ACTIONS } from '$lib/moderation';

const Resolve = v.object({
	targetType: v.picklist(REPORT_TARGET_TYPES, 'Invalid target type'),
	targetId: v.pipe(v.string('Target is required'), v.trim(), v.minLength(1, 'Target is required')),
	action: v.picklist(RESOLVE_ACTIONS, 'Choose an action'),
	durationDays: v.optional(
		v.nullable(
			v.pipe(
				v.number('Duration must be a number'),
				v.integer('Duration must be a whole number of days'),
				v.minValue(1, 'Duration must be at least 1 day'),
				v.maxValue(MAX_SUSPENSION_DAYS, `Duration cannot exceed ${MAX_SUSPENSION_DAYS} days`)
			)
		)
	),
	note: ModerationNote
});

/**
 * Resolves every open report on a target: `dismiss`, `remove_content` (soft-deletes a post or
 * message, deletes a comment) or `suspend_user` (the target's owner, for `durationDays` or
 * indefinitely). Writes an audit row. Body: `targetType`, `targetId`, `action`, optional
 * `durationDays` and `note`.
 */
export const POST: RequestHandler = withApi(async ({ request, locals, platform }) => {
	const moderator = requireModerator(locals);
	await enforceRateLimit(platform, 'moderation', moderator.id);
	const body = await parseBody(request, Resolve);
	await resolveReports(locals.db, {
		moderator,
		...body,
		durationDays: body.durationDays ?? null,
		note: body.note || null
	});
	return json({ resolved: true });
});

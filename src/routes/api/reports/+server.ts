import { json } from '@sveltejs/kit';
import * as v from 'valibot';
import type { RequestHandler } from './$types';
import { ApiError, enforceRateLimit, parseBody, requireUser, withApi } from '$lib/server/api';
import { REPORT_DETAILS_MAX, REPORT_REASONS, REPORT_TARGET_TYPES } from '$lib/server/db/schema';
import { createReport, findReportTargetOwner } from '$lib/server/db/reports';

const CreateReport = v.object({
	targetType: v.picklist(REPORT_TARGET_TYPES, 'Invalid target type'),
	targetId: v.pipe(v.string('Target is required'), v.trim(), v.minLength(1, 'Target is required')),
	reason: v.picklist(REPORT_REASONS, 'Choose a reason'),
	details: v.optional(
		v.nullable(
			v.pipe(
				v.string('Details must be text'),
				v.trim(),
				v.maxLength(REPORT_DETAILS_MAX, `Details must be at most ${REPORT_DETAILS_MAX} characters`)
			)
		)
	)
});

/**
 * Reports a post, comment, user or message for review. 201 on create; 200 when the viewer already
 * has an open report on the same target (idempotent). Body: `targetType`, `targetId`, `reason`,
 * optional `details`.
 */
export const POST: RequestHandler = withApi(async ({ request, locals, platform }) => {
	const viewer = requireUser(locals);
	await enforceRateLimit(platform, 'report', viewer.id);
	const { targetType, targetId, reason, details } = await parseBody(request, CreateReport);

	const ownerId = await findReportTargetOwner(locals.db, viewer.id, targetType, targetId);
	if (ownerId === null) throw new ApiError(404, 'not_found', 'Content not found');
	if (ownerId === viewer.id) {
		throw new ApiError(400, 'cannot_report_self', 'You cannot report yourself or your own content');
	}

	const { created } = await createReport(locals.db, {
		reporterId: viewer.id,
		targetType,
		targetId,
		reason,
		details: details || null
	});
	return json({ reported: true }, { status: created ? 201 : 200 });
});

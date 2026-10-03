import { json } from '@sveltejs/kit';
import * as v from 'valibot';
import type { RequestHandler } from './$types';
import { ApiError, enforceRateLimit, parseBody, requireUser, withApi } from '$lib/server/api';
import { deleteMediaObjects } from '$lib/server/services/storage';
import {
	deleteDraft,
	draftPayload,
	publishTime,
	requireOwnDraft,
	toDraftData,
	updateDraft
} from '$lib/server/posts/drafts';

/** The fields of POST /api/drafts; omitted ones stay as they are, a null `publishAt` unschedules. */
const UpdateDraftBody = v.object(
	{
		payload: v.optional(v.record(v.string(), v.unknown(), 'Payload must be an object')),
		publishAt: v.optional(
			v.nullable(v.pipe(v.string(), v.isoTimestamp('Publish time must be an ISO timestamp')))
		)
	},
	'Request body must be an object'
);

export const GET: RequestHandler = withApi(async ({ params, locals }) => {
	const currentUser = requireUser(locals);
	const draft = await requireOwnDraft(locals.db, currentUser.id, params.id);
	return json({ draft: toDraftData(draft) });
});

export const PATCH: RequestHandler = withApi(async ({ params, request, locals, platform }) => {
	const currentUser = requireUser(locals);
	await enforceRateLimit(platform, 'draft', currentUser.id);
	const body = await parseBody(request, UpdateDraftBody);
	if (body.payload === undefined && body.publishAt === undefined) {
		throw new ApiError(400, 'validation_failed', 'No valid fields provided to update');
	}

	const draft = await updateDraft(locals.db, currentUser.id, params.id, {
		payload: body.payload && draftPayload(platform, currentUser.id, body.payload),
		publishAt: body.publishAt && publishTime(body.publishAt)
	});
	return json({ draft });
});

export const DELETE: RequestHandler = withApi(async ({ params, locals, platform }) => {
	const currentUser = requireUser(locals);
	await enforceRateLimit(platform, 'draft', currentUser.id);
	const mediaKeys = await deleteDraft(locals.db, currentUser.id, params.id);

	if (mediaKeys.length > 0) {
		const cleanup = deleteMediaObjects(mediaKeys, platform?.env);
		if (platform?.ctx?.waitUntil) {
			platform.ctx.waitUntil(cleanup);
		} else {
			await cleanup;
		}
	}

	return new Response(null, { status: 204 });
});

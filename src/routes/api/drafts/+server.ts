import { json } from '@sveltejs/kit';
import * as v from 'valibot';
import type { RequestHandler } from './$types';
import { enforceRateLimit, parseBody, requireUser, withApi } from '$lib/server/api';
import { createDraft, draftPayload, listDrafts, publishTime } from '$lib/server/posts/drafts';

/** The payload stays loose here: `draftPayload` checks it with the create-post rules. */
const CreateDraftBody = v.object(
	{
		payload: v.record(v.string(), v.unknown(), 'Payload must be an object'),
		publishAt: v.optional(
			v.nullable(v.pipe(v.string(), v.isoTimestamp('Publish time must be an ISO timestamp')))
		)
	},
	'Request body must be an object'
);

export const GET: RequestHandler = withApi(async ({ locals }) => {
	const currentUser = requireUser(locals);
	return json({ drafts: await listDrafts(locals.db, currentUser.id) });
});

export const POST: RequestHandler = withApi(async ({ request, locals, platform }) => {
	const currentUser = requireUser(locals);
	await enforceRateLimit(platform, 'draft', currentUser.id);
	const body = await parseBody(request, CreateDraftBody);
	const draft = await createDraft(
		locals.db,
		currentUser.id,
		draftPayload(platform, currentUser.id, body.payload),
		body.publishAt ? publishTime(body.publishAt) : null
	);
	return json({ draft }, { status: 201 });
});

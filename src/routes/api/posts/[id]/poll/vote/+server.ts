import { json } from '@sveltejs/kit';
import * as v from 'valibot';
import type { RequestHandler } from './$types';
import { enforceRateLimit, parseBody, requireUser, withApi } from '$lib/server/api';
import { requireVisiblePost } from '$lib/server/db/posts';
import { requireNotBlocked } from '$lib/server/db/blocks';
import { votePoll } from '$lib/server/db/polls';

const VoteBody = v.object(
	{ optionId: v.pipe(v.string('Option ID must be a string'), v.minLength(1, 'Choose an option')) },
	'Request body must be an object'
);

/** Votes in `:id`'s poll. A vote is final: 409 once the user voted or the poll closed. */
export const POST: RequestHandler = withApi(async ({ params, request, locals, platform }) => {
	const currentUser = requireUser(locals);
	await enforceRateLimit(platform, 'pollVote', currentUser.id);
	const { optionId } = await parseBody(request, VoteBody);

	const target = await requireVisiblePost(locals.db, currentUser.id, params.id);
	await requireNotBlocked(
		locals.db,
		currentUser.id,
		target.authorId,
		'You cannot vote in this poll'
	);

	const poll = await votePoll(locals.db, currentUser.id, target.id, optionId);
	return json({ poll });
});

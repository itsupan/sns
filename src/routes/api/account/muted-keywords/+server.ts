import * as v from 'valibot';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { MAX_MUTED_KEYWORD_LENGTH } from '$lib/constants/mute-limits';
import { addMutedKeyword, listMutedKeywords, removeMutedKeyword } from '$lib/server/db/mutes';
import { enforceRateLimit, parseBody, requireUser, withApi } from '$lib/server/api';

/** Keywords are stored trimmed and lowercased, so matching and duplicates ignore case. */
const KeywordBody = v.object({
	keyword: v.pipe(
		v.string(),
		v.trim(),
		v.toLowerCase(),
		v.minLength(1, 'Enter a keyword'),
		v.maxLength(
			MAX_MUTED_KEYWORD_LENGTH,
			`Keywords can be at most ${MAX_MUTED_KEYWORD_LENGTH} characters`
		)
	)
});

/** The caller's muted keywords, most recent first. */
export const GET: RequestHandler = withApi(async ({ locals }) => {
	const me = requireUser(locals);
	return json({ keywords: await listMutedKeywords(locals.db, me.id) });
});

/** Mutes a keyword: posts containing it leave the caller's feeds. Idempotent. */
export const POST: RequestHandler = withApi(async ({ locals, platform, request }) => {
	const me = requireUser(locals);
	await enforceRateLimit(platform, 'mute', me.id);
	const { keyword } = await parseBody(request, KeywordBody);
	await addMutedKeyword(locals.db, me.id, keyword);
	return json({ keyword }, { status: 201 });
});

/** Unmutes a keyword. Idempotent: removing one that isn't muted is a no-op. */
export const DELETE: RequestHandler = withApi(async ({ locals, platform, request }) => {
	const me = requireUser(locals);
	await enforceRateLimit(platform, 'mute', me.id);
	const { keyword } = await parseBody(request, KeywordBody);
	await removeMutedKeyword(locals.db, me.id, keyword);
	return new Response(null, { status: 204 });
});

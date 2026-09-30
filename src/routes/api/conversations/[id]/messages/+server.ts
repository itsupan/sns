import { json } from '@sveltejs/kit';
import * as v from 'valibot';
import type { RequestHandler } from './$types';
import {
	enforceRateLimit,
	parseBody,
	parsePageQuery,
	parseQuery,
	requireUser,
	withApi
} from '$lib/server/api';
import { getConfig } from '$lib/server/config';
import { listMessages, requireMembership, sendMessage } from '$lib/server/db/chat';
import { broadcastLater } from '$lib/server/chat/rooms';
import { MAX_MESSAGE_LENGTH } from '$lib/chat/types';

const SendMessage = v.object({
	/** Client-generated, so a retried send is stored once (see sendMessage). */
	id: v.optional(v.pipe(v.string('Invalid message id'), v.uuid('Invalid message id'))),
	content: v.pipe(
		v.string('Message is required'),
		v.trim(),
		v.minLength(1, 'Message is required'),
		v.maxLength(MAX_MESSAGE_LENGTH, `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters`)
	)
});

/**
 * History, oldest first. Query: `limit`, `cursor` (older page), or `after` (message id) to
 * catch up after a reconnect; add `strict=1` for the following pages of a catch-up.
 */
export const GET: RequestHandler = withApi(async ({ params, url, locals, platform }) => {
	const viewer = requireUser(locals);
	await requireMembership(locals.db, params.id, viewer.id);
	const { limit, cursor } = await parsePageQuery(url, getConfig(platform?.env).chat.messages);
	const { after, strict } = await parseQuery(
		url,
		v.object({ after: v.optional(v.string()), strict: v.optional(v.string()) })
	);
	return json(
		await listMessages(locals.db, {
			conversationId: params.id,
			limit,
			cursor,
			after,
			strict: strict === '1'
		})
	);
});

/** Stores a message (201), or returns it again for a retried `id` (200), then pushes it live. */
export const POST: RequestHandler = withApi(async ({ params, request, locals, platform }) => {
	const viewer = requireUser(locals);
	await enforceRateLimit(platform, 'chatMessage', viewer.id);
	const { id, content } = await parseBody(request, SendMessage);
	await requireMembership(locals.db, params.id, viewer.id);

	const { message, created } = await sendMessage(locals.db, {
		id,
		conversationId: params.id,
		senderId: viewer.id,
		content
	});
	// A replayed send was already broadcast the first time.
	if (created) broadcastLater(platform, params.id, { type: 'message', message });
	return json({ message }, { status: created ? 201 : 200 });
});

import { describe, expect, it } from 'vitest';
import { POST } from './+server';
import type { RequestEvent } from './$types';

// Listing, replies, deletes and reactions run against a real D1 in
// src/lib/server/db/comments.spec.ts; these cover request validation only.
describe('POST /api/posts/:id/comments', () => {
	it('returns 401 when unauthenticated', async () => {
		const event = {
			params: { id: 'post-1' },
			request: { json: async () => ({ content: 'Nice!' }) },
			locals: { user: null }
		} as unknown as RequestEvent;

		const res = await POST(event);
		expect(res.status).toBe(401);
	});

	it('returns 400 when content is empty', async () => {
		const event = {
			params: { id: 'post-1' },
			request: { json: async () => ({ content: '   ' }) },
			locals: { user: { id: 'u-1', name: 'Kai' } }
		} as unknown as RequestEvent;

		const res = await POST(event);
		expect(res.status).toBe(400);
	});

	it('returns 400 when parentCommentId is not a string', async () => {
		const event = {
			params: { id: 'post-1' },
			request: { json: async () => ({ content: 'Nice!', parentCommentId: 42 }) },
			locals: { user: { id: 'u-1', name: 'Kai' } }
		} as unknown as RequestEvent;

		const res = await POST(event);
		expect(res.status).toBe(400);
	});
});

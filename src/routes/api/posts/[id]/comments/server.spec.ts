import { describe, expect, it, vi } from 'vitest';
import { GET, POST } from './+server';
import type { RequestEvent } from './$types';

describe('GET /api/posts/:id/comments', () => {
	it('returns comments for a post', async () => {
		const mockComments = [
			{
				id: 'c-1',
				content: 'Beautiful composition',
				createdAt: new Date(),
				user: {
					id: 'u-2',
					name: 'Marcus',
					handle: 'marcus',
					image: ''
				}
			}
		];

		const db = {
			select: vi.fn(() => ({
				from: vi.fn(() => ({
					innerJoin: vi.fn(() => ({
						where: vi.fn(() => ({
							orderBy: vi.fn(async () => mockComments)
						}))
					}))
				}))
			}))
		};

		const event = {
			params: { id: 'post-1' },
			locals: { db }
		} as unknown as RequestEvent;

		const res = await GET(event);
		expect(res.status).toBe(200);

		const data = (await res.json()) as {
			comments: Array<{ content: string; author: { name: string } }>;
		};
		expect(data.comments).toHaveLength(1);
		expect(data.comments[0].content).toBe('Beautiful composition');
		expect(data.comments[0].author.name).toBe('Marcus');
	});
});

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
});

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

	it('adds a comment and updates commentsCount', async () => {
		let insertedComment: Record<string, unknown> | null = null;
		let updatedPost: Record<string, unknown> | null = null;

		const db = {
			select: vi.fn(() => ({
				from: vi.fn(() => ({
					where: vi.fn(() => ({
						limit: vi.fn(async () => [{ id: 'post-1', commentsCount: 3 }])
					}))
				}))
			})),
			insert: vi.fn(() => ({
				values: vi.fn(async (val: Record<string, unknown>) => {
					insertedComment = val;
					return [{ success: true }];
				})
			})),
			update: vi.fn(() => ({
				set: vi.fn((val: Record<string, unknown>) => {
					updatedPost = val;
					return {
						where: vi.fn(async () => [{ success: true }])
					};
				})
			}))
		};

		const event = {
			params: { id: 'post-1' },
			request: { json: async () => ({ content: 'Incredible lighting!' }) },
			locals: {
				db,
				user: { id: 'u-1', name: 'Kai Takahashi', handle: 'kai.raw', image: '' }
			}
		} as unknown as RequestEvent;

		const res = await POST(event);
		expect(res.status).toBe(201);

		const data = (await res.json()) as {
			comment: { content: string };
			commentsCount: number;
		};
		expect(data.comment.content).toBe('Incredible lighting!');
		expect(data.commentsCount).toBe(4);
		expect(insertedComment).not.toBeNull();
		expect(updatedPost).toMatchObject({ commentsCount: 4 });
	});
});

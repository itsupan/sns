import { describe, expect, it, vi } from 'vitest';
import { POST } from './+server';
import type { RequestEvent } from './$types';

describe('POST /api/posts/:id/like', () => {
	it('returns 401 when unauthenticated', async () => {
		const event = {
			params: { id: 'post-1' },
			locals: { user: null }
		} as unknown as RequestEvent;

		const res = await POST(event);
		expect(res.status).toBe(401);
	});

	it('returns 404 when post does not exist', async () => {
		const db = {
			select: vi.fn(() => ({
				from: vi.fn(() => ({
					where: vi.fn(() => ({
						limit: vi.fn(async () => [])
					}))
				}))
			}))
		};

		const event = {
			params: { id: 'non-existent' },
			locals: { db, user: { id: 'u-1' } }
		} as unknown as RequestEvent;

		const res = await POST(event);
		expect(res.status).toBe(404);
	});

	it('likes a post if not yet liked', async () => {
		let updatedPost: Record<string, unknown> | null = null;
		let insertedLike: Record<string, unknown> | null = null;

		const db = {
			select: vi
				.fn()
				// First select: post exists
				.mockReturnValueOnce({
					from: vi.fn(() => ({
						where: vi.fn(() => ({
							limit: vi.fn(async () => [{ id: 'post-1', likesCount: 5 }])
						}))
					}))
				})
				// Second select: existing like check (none)
				.mockReturnValueOnce({
					from: vi.fn(() => ({
						where: vi.fn(() => ({
							limit: vi.fn(async () => [])
						}))
					}))
				}),
			insert: vi.fn(() => ({
				values: vi.fn(async (val: Record<string, unknown>) => {
					insertedLike = val;
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
			locals: { db, user: { id: 'u-1' } }
		} as unknown as RequestEvent;

		const res = await POST(event);
		expect(res.status).toBe(200);

		const data = await res.json();
		expect(data).toEqual({ liked: true, likesCount: 6 });
		expect(insertedLike).not.toBeNull();
		expect(updatedPost).toMatchObject({ likesCount: 6 });
	});

	it('unlikes a post if already liked', async () => {
		let deleted = false;
		let updatedPost: Record<string, unknown> | null = null;

		const db = {
			select: vi
				.fn()
				// First select: post exists
				.mockReturnValueOnce({
					from: vi.fn(() => ({
						where: vi.fn(() => ({
							limit: vi.fn(async () => [{ id: 'post-1', likesCount: 10 }])
						}))
					}))
				})
				// Second select: existing like check (found)
				.mockReturnValueOnce({
					from: vi.fn(() => ({
						where: vi.fn(() => ({
							limit: vi.fn(async () => [{ id: 'like-1' }])
						}))
					}))
				}),
			delete: vi.fn(() => ({
				where: vi.fn(async () => {
					deleted = true;
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
			locals: { db, user: { id: 'u-1' } }
		} as unknown as RequestEvent;

		const res = await POST(event);
		expect(res.status).toBe(200);

		const data = await res.json();
		expect(data).toEqual({ liked: false, likesCount: 9 });
		expect(deleted).toBe(true);
		expect(updatedPost).toMatchObject({ likesCount: 9 });
	});
});

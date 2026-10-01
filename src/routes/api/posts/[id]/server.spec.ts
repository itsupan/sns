import { describe, expect, it, vi } from 'vitest';
import { DELETE } from './+server';
import { loadPostMedia } from '$lib/server/db/posts';
import { deleteMediaObjects } from '$lib/server/services/storage';

vi.mock('$lib/server/db/posts', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/server/db/posts')>()),
	loadPostMedia: vi.fn(async () => new Map())
}));
vi.mock('$lib/server/services/storage', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/server/services/storage')>()),
	deleteMediaObjects: vi.fn(async () => {})
}));
import type { RequestEvent } from './$types';
import type { ApiErrorBody } from '$lib/server/api';

describe('DELETE /api/posts/:id', () => {
	it('returns 401 when user is not authenticated', async () => {
		const event = {
			params: { id: 'post-1' },
			locals: { user: null }
		} as unknown as RequestEvent;

		const res = await DELETE(event);
		expect(res.status).toBe(401);
		const data = (await res.json()) as ApiErrorBody;
		expect(data.error.code).toBe('unauthorized');
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
			locals: { db, user: { id: 'user-1' } }
		} as unknown as RequestEvent;

		const res = await DELETE(event);
		expect(res.status).toBe(404);
		const data = (await res.json()) as ApiErrorBody;
		expect(data.error.code).toBe('not_found');
	});

	it('returns 404 when post is already deleted', async () => {
		const db = {
			select: vi.fn(() => ({
				from: vi.fn(() => ({
					where: vi.fn(() => ({
						limit: vi.fn(async () => [
							{
								id: 'post-deleted',
								userId: 'user-1',
								deletedAt: new Date()
							}
						])
					}))
				}))
			}))
		};

		const event = {
			params: { id: 'post-deleted' },
			locals: { db, user: { id: 'user-1' } }
		} as unknown as RequestEvent;

		const res = await DELETE(event);
		expect(res.status).toBe(404);
		const data = (await res.json()) as ApiErrorBody;
		expect(data.error.code).toBe('not_found');
	});

	it('returns 403 when user is not the owner of the post', async () => {
		const db = {
			select: vi.fn(() => ({
				from: vi.fn(() => ({
					where: vi.fn(() => ({
						limit: vi.fn(async () => [
							{
								id: 'post-1',
								userId: 'user-2', // Different user
								deletedAt: null
							}
						])
					}))
				}))
			}))
		};

		const event = {
			params: { id: 'post-1' },
			locals: { db, user: { id: 'user-1' } }
		} as unknown as RequestEvent;

		const res = await DELETE(event);
		expect(res.status).toBe(403);
		const data = (await res.json()) as ApiErrorBody;
		expect(data.error.code).toBe('forbidden');
	});

	it('soft deletes the post and returns 204 when user is the owner', async () => {
		const updateMock = vi.fn(() => ({
			set: vi.fn(() => ({
				where: vi.fn(async () => [{ success: true }])
			}))
		}));

		const db = {
			select: vi.fn(() => ({
				from: vi.fn(() => ({
					where: vi.fn(() => ({
						limit: vi.fn(async () => [
							{
								id: 'post-1',
								userId: 'user-1',
								deletedAt: null
							}
						])
					}))
				}))
			})),
			update: updateMock
		};

		const event = {
			params: { id: 'post-1' },
			locals: { db, user: { id: 'user-1' } }
		} as unknown as RequestEvent;

		const res = await DELETE(event);
		expect(res.status).toBe(204);

		// Ensure that update was called (soft delete)
		expect(updateMock).toHaveBeenCalled();
	});

	it("cleans up only the owner's media after soft deleting", async () => {
		vi.mocked(loadPostMedia).mockResolvedValueOnce(
			new Map([
				[
					'post-1',
					[
						{ url: '/api/upload/mock-r2/posts/user-1/a.jpg', type: 'image' },
						{ url: 'posts/user-2/victim.jpg', type: 'image' }
					]
				]
			])
		);
		const db = {
			select: vi.fn(() => ({
				from: vi.fn(() => ({
					where: vi.fn(() => ({
						limit: vi.fn(async () => [{ id: 'post-1', userId: 'user-1', deletedAt: null }])
					}))
				}))
			})),
			update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => []) })) }))
		};
		const waitUntil = vi.fn();
		const env = {};

		const event = {
			params: { id: 'post-1' },
			locals: { db, user: { id: 'user-1' } },
			platform: { env, ctx: { waitUntil } }
		} as unknown as RequestEvent;

		const res = await DELETE(event);
		expect(res.status).toBe(204);
		expect(db.update).toHaveBeenCalled();
		expect(deleteMediaObjects).toHaveBeenCalledWith(['posts/user-1/a.jpg'], env);
		expect(waitUntil).toHaveBeenCalledTimes(1);
	});
});

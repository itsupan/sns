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
});

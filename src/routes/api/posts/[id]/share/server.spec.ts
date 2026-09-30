import { describe, expect, it } from 'vitest';
import { POST } from './+server';
import type { RequestEvent } from './$types';

describe('POST /api/posts/:id/share', () => {
	it('returns 401 when unauthenticated, so shares cannot be inflated anonymously', async () => {
		const event = { params: { id: 'post-1' }, locals: { user: null } } as unknown as RequestEvent;

		const res = await POST(event);
		expect(res.status).toBe(401);
	});
});

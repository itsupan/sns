import { describe, expect, it } from 'vitest';
import { POST } from './+server';
import type { RequestEvent } from './$types';

describe('POST /api/upload/presigned', () => {
	it('returns 401 if user is not authenticated', async () => {
		const event = {
			locals: { user: null },
			request: new Request('http://localhost/api/upload/presigned', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ filename: 'test.jpg', contentType: 'image/jpeg' })
			}),
			platform: { env: {} }
		} as unknown as RequestEvent;

		const response = await POST(event);
		expect(response.status).toBe(401);
		const data = await response.json();
		expect(data).toEqual({ error: 'Unauthorized' });
	});

	it('returns 400 if filename is missing', async () => {
		const event = {
			locals: { user: { id: 'user-1' } },
			request: new Request('http://localhost/api/upload/presigned', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ contentType: 'image/jpeg' })
			}),
			platform: { env: {} }
		} as unknown as RequestEvent;

		const response = await POST(event);
		expect(response.status).toBe(400);
		const data = (await response.json()) as { error?: string };
		expect(data.error).toBe('Filename is required');
	});

	it('returns 400 if contentType is missing or invalid', async () => {
		const event = {
			locals: { user: { id: 'user-1' } },
			request: new Request('http://localhost/api/upload/presigned', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ filename: 'file.pdf', contentType: 'application/pdf' })
			}),
			platform: { env: {} }
		} as unknown as RequestEvent;

		const response = await POST(event);
		expect(response.status).toBe(400);
		const data = (await response.json()) as { error?: string };
		expect(data.error).toContain('Invalid MIME type');
	});

	it('returns presigned URL details on valid request', async () => {
		const event = {
			locals: { user: { id: 'user-1' } },
			request: new Request('http://localhost/api/upload/presigned', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ filename: 'avatar.png', contentType: 'image/png', size: 1024 })
			}),
			platform: { env: {} }
		} as unknown as RequestEvent;

		const response = await POST(event);
		expect(response.status).toBe(200);
		const data = (await response.json()) as { uploadUrl: string; publicUrl: string; key: string };
		expect(data).toHaveProperty('uploadUrl');
		expect(data).toHaveProperty('publicUrl');
		expect(data).toHaveProperty('key');
		expect(data.key).toContain('avatars/user-1/');
	});
});

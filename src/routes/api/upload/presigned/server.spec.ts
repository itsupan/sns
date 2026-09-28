import type { ApiErrorBody } from '$lib/server/api';
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
		expect(data).toEqual({ error: { code: 'unauthorized', message: 'You must be signed in' } });
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
		const data = (await response.json()) as ApiErrorBody;
		expect(data.error.message).toBe('Filename is required');
		expect(data.error.fields).toHaveProperty('filename');
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
		const data = (await response.json()) as ApiErrorBody;
		expect(data.error.message).toContain('Invalid MIME type');
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

	it('puts story uploads under stories/<userId>/ and rejects unknown folders', async () => {
		const call = (folder: unknown) =>
			POST({
				locals: { user: { id: 'user-1' } },
				request: new Request('http://localhost/api/upload/presigned', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ filename: 'clip.mp4', contentType: 'video/mp4', folder })
				}),
				platform: { env: {} }
			} as unknown as RequestEvent);

		const ok = await call('stories');
		expect(ok.status).toBe(200);
		expect(((await ok.json()) as { key: string }).key).toMatch(/^stories\/user-1\//);

		const bad = await call('secrets');
		expect(bad.status).toBe(400);
		expect(((await bad.json()) as ApiErrorBody).error.fields).toHaveProperty('folder');
	});
});

import { describe, it, expect } from 'vitest';
import { POST } from './+server';

describe('POST /api/media/refresh', () => {
	it('returns 400 if body is invalid JSON or urls is not an array', async () => {
		const request = new Request('http://localhost/api/media/refresh', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ urls: 'not-an-array' })
		});

		const res = await POST({ request, platform: undefined } as never);
		expect(res.status).toBe(400);
	});

	it('refreshes expired presigned URLs and returns map', async () => {
		const expiredUrl =
			'https://bucket.acc.r2.cloudflarestorage.com/posts/u1/photo.jpg?X-Amz-Date=20200101T000000Z&X-Amz-Expires=3600';
		const validUrl = 'https://images.unsplash.com/photo-123';

		const mockPlatform = {
			env: {
				R2_PUBLIC_URL: 'https://cdn.example.com'
			}
		} as unknown as App.Platform;

		const request = new Request('http://localhost/api/media/refresh', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ urls: [expiredUrl, validUrl] })
		});

		const res = await POST({ request, platform: mockPlatform } as never);
		expect(res.status).toBe(200);

		const data = (await res.json()) as { refreshed: Record<string, string> };
		expect(data.refreshed[expiredUrl]).toBe('https://cdn.example.com/posts/u1/photo.jpg');
		expect(data.refreshed[validUrl]).toBe(validUrl);
	});
});

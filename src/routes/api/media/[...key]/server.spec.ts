import { describe, it, expect, beforeEach } from 'vitest';
import { GET, HEAD, PUT, OPTIONS } from './+server';
import { mockStorage } from '$lib/server/services/media-storage';

describe('media proxy endpoint (/api/media/[...key])', () => {
	beforeEach(() => {
		mockStorage.clear();
	});

	describe('OPTIONS', () => {
		it('returns 204 with CORS headers', async () => {
			const res = await OPTIONS({} as never);
			expect(res.status).toBe(204);
			expect(res.headers.get('access-control-allow-origin')).toBe('*');
		});
	});

	describe('PUT', () => {
		it('stores media in memory and returns 200 with ETag', async () => {
			const data = new Uint8Array([1, 2, 3]);
			const request = new Request('http://localhost/api/media/posts/test.mp4', {
				method: 'PUT',
				headers: { 'content-type': 'video/mp4' },
				body: data
			});

			const res = await PUT({
				params: { key: 'posts/test.mp4' },
				request,
				platform: undefined
			} as never);

			expect(res.status).toBe(200);
			expect(mockStorage.has('posts/test.mp4')).toBe(true);
		});
	});

	describe('GET', () => {
		it('redirects 302 to R2_PUBLIC_URL when configured', async () => {
			const mockPlatform = {
				env: {
					R2_PUBLIC_URL: 'https://cdn.example.com'
				}
			} as unknown as App.Platform;

			const request = new Request('http://localhost/api/media/posts/photo.jpg');
			const res = await GET({
				params: { key: 'posts/photo.jpg' },
				request,
				platform: mockPlatform
			} as never);

			expect(res.status).toBe(302);
			expect(res.headers.get('location')).toBe('https://cdn.example.com/posts/photo.jpg');
		});

		it('streams from memory/KV with 200 OK and Accept-Ranges', async () => {
			const data = new Uint8Array([10, 20, 30, 40]);
			mockStorage.set('posts/photo.webp', {
				buffer: data.buffer,
				contentType: 'image/webp'
			});

			const request = new Request('http://localhost/api/media/posts/photo.webp');
			const res = await GET({
				params: { key: 'posts/photo.webp' },
				request,
				platform: undefined
			} as never);

			expect(res.status).toBe(200);
			expect(res.headers.get('content-type')).toBe('image/webp');
			expect(res.headers.get('accept-ranges')).toBe('bytes');
			const body = new Uint8Array(await res.arrayBuffer());
			expect(body).toEqual(data);
		});

		it('supports Range requests with 206 Partial Content (crucial for video streaming)', async () => {
			const data = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
			mockStorage.set('posts/video.mp4', {
				buffer: data.buffer,
				contentType: 'video/mp4'
			});

			const request = new Request('http://localhost/api/media/posts/video.mp4', {
				headers: { range: 'bytes=0-3' }
			});
			const res = await GET({
				params: { key: 'posts/video.mp4' },
				request,
				platform: undefined
			} as never);

			expect(res.status).toBe(206);
			expect(res.headers.get('content-range')).toBe('bytes 0-3/10');
			expect(res.headers.get('content-length')).toBe('4');
			expect(res.headers.get('content-type')).toBe('video/mp4');
			const body = new Uint8Array(await res.arrayBuffer());
			expect(body).toEqual(new Uint8Array([0, 1, 2, 3]));
		});

		it('returns 404 when media is not found', async () => {
			const request = new Request('http://localhost/api/media/missing.jpg');
			const res = await GET({
				params: { key: 'missing.jpg' },
				request,
				platform: undefined
			} as never);

			expect(res.status).toBe(404);
		});
	});

	describe('HEAD', () => {
		it('returns media headers without body for HEAD request', async () => {
			const data = new Uint8Array([1, 2, 3, 4, 5]);
			mockStorage.set('posts/test.mp4', {
				buffer: data.buffer,
				contentType: 'video/mp4'
			});

			const request = new Request('http://localhost/api/media/posts/test.mp4');
			const res = await HEAD({
				params: { key: 'posts/test.mp4' },
				request,
				platform: undefined
			} as never);

			expect(res.status).toBe(200);
			expect(res.headers.get('content-length')).toBe('5');
			expect(res.headers.get('accept-ranges')).toBe('bytes');
		});
	});
});

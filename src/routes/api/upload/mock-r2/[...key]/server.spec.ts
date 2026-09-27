import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PUT, GET, HEAD, OPTIONS } from './+server';
import { mockStorage, inferContentType, parseRange } from '$lib/server/services/media-storage';

describe('mock-r2 storage endpoint', () => {
	beforeEach(() => {
		mockStorage.clear();
	});

	describe('inferContentType', () => {
		it('infers correct mime types for common image and video formats', () => {
			expect(inferContentType('test.mp4')).toBe('video/mp4');
			expect(inferContentType('test.webm')).toBe('video/webm');
			expect(inferContentType('test.mov')).toBe('video/quicktime');
			expect(inferContentType('photo.jpg')).toBe('image/jpeg');
			expect(inferContentType('photo.png')).toBe('image/png');
			expect(inferContentType('photo.webp')).toBe('image/webp');
			expect(inferContentType('unknown.xyz', 'custom/type')).toBe('custom/type');
		});
	});

	describe('parseRange', () => {
		it('returns null when range header is absent or does not start with bytes=', () => {
			expect(parseRange(null, 1000)).toBeNull();
			expect(parseRange('invalid', 1000)).toBeNull();
		});

		it('parses closed range bytes=0-100 correctly', () => {
			expect(parseRange('bytes=0-100', 1000)).toEqual({ start: 0, end: 100 });
		});

		it('parses open-ended range bytes=500- correctly', () => {
			expect(parseRange('bytes=500-', 1000)).toEqual({ start: 500, end: 999 });
		});

		it('parses suffix range bytes=-200 correctly', () => {
			expect(parseRange('bytes=-200', 1000)).toEqual({ start: 800, end: 999 });
		});

		it('clamps end to totalSize - 1 if end exceeds totalSize', () => {
			expect(parseRange('bytes=0-2000', 1000)).toEqual({ start: 0, end: 999 });
		});

		it('returns "invalid" for out of range or malformed headers', () => {
			expect(parseRange('bytes=1500-', 1000)).toBe('invalid');
			expect(parseRange('bytes=500-200', 1000)).toBe('invalid');
			expect(parseRange('bytes=abc-def', 1000)).toBe('invalid');
		});
	});

	describe('PUT', () => {
		it('stores arrayBuffer in memory and returns 200 with CORS headers', async () => {
			const data = new Uint8Array([1, 2, 3, 4, 5]);
			const request = new Request('http://localhost/api/upload/mock-r2/posts/test.mp4', {
				method: 'PUT',
				headers: { 'content-type': 'video/mp4' },
				body: data
			});

			const response = await PUT({
				params: { key: 'posts/test.mp4' },
				request,
				platform: undefined
			} as never);

			expect(response.status).toBe(200);
			expect(response.headers.get('access-control-allow-origin')).toBe('*');
			expect(mockStorage.has('posts/test.mp4')).toBe(true);
			const stored = mockStorage.get('posts/test.mp4');
			expect(stored?.contentType).toBe('video/mp4');
			expect(new Uint8Array(stored!.buffer)).toEqual(data);
		});

		it('persists to Cloudflare KV when platform.env.KV is provided', async () => {
			const mockKvPut = vi.fn().mockResolvedValue(undefined);
			const mockPlatform = {
				env: {
					KV: {
						put: mockKvPut
					}
				}
			} as unknown as App.Platform;

			const data = new Uint8Array([10, 20, 30]);
			const request = new Request('http://localhost/api/upload/mock-r2/posts/test.jpg', {
				method: 'PUT',
				headers: { 'content-type': 'image/jpeg' },
				body: data
			});

			const response = await PUT({
				params: { key: 'posts/test.jpg' },
				request,
				platform: mockPlatform
			} as never);

			expect(response.status).toBe(200);
			expect(mockKvPut).toHaveBeenCalledWith(
				'posts/test.jpg',
				expect.any(ArrayBuffer),
				expect.objectContaining({ metadata: { contentType: 'image/jpeg' } })
			);
		});
	});

	describe('GET', () => {
		it('returns 404 when item is not found', async () => {
			const request = new Request('http://localhost/api/upload/mock-r2/non-existent.mp4');
			const response = await GET({
				params: { key: 'non-existent.mp4' },
				request,
				platform: undefined
			} as never);

			expect(response.status).toBe(404);
		});

		it('returns full file with 200 OK and Accept-Ranges: bytes', async () => {
			const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
			mockStorage.set('posts/photo.webp', {
				buffer: data.buffer,
				contentType: 'image/webp'
			});

			const request = new Request('http://localhost/api/upload/mock-r2/posts/photo.webp');
			const response = await GET({
				params: { key: 'posts/photo.webp' },
				request,
				platform: undefined
			} as never);

			expect(response.status).toBe(200);
			expect(response.headers.get('content-type')).toBe('image/webp');
			expect(response.headers.get('accept-ranges')).toBe('bytes');
			expect(response.headers.get('content-length')).toBe('8');
			const body = new Uint8Array(await response.arrayBuffer());
			expect(body).toEqual(data);
		});

		it('supports Range requests with 206 Partial Content (critical for Safari & video playback)', async () => {
			const data = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
			mockStorage.set('posts/video.mp4', {
				buffer: data.buffer,
				contentType: 'video/mp4'
			});

			// Safari initial video probe: bytes=0-1
			const request = new Request('http://localhost/api/upload/mock-r2/posts/video.mp4', {
				headers: { range: 'bytes=0-1' }
			});
			const response = await GET({
				params: { key: 'posts/video.mp4' },
				request,
				platform: undefined
			} as never);

			expect(response.status).toBe(206);
			expect(response.headers.get('content-range')).toBe('bytes 0-1/10');
			expect(response.headers.get('content-length')).toBe('2');
			expect(response.headers.get('accept-ranges')).toBe('bytes');
			expect(response.headers.get('content-type')).toBe('video/mp4');

			const body = new Uint8Array(await response.arrayBuffer());
			expect(body).toEqual(new Uint8Array([0, 1]));
		});

		it('returns 416 Range Not Satisfiable when range is invalid', async () => {
			const data = new Uint8Array([0, 1, 2]);
			mockStorage.set('posts/small.mp4', {
				buffer: data.buffer,
				contentType: 'video/mp4'
			});

			const request = new Request('http://localhost/api/upload/mock-r2/posts/small.mp4', {
				headers: { range: 'bytes=50-100' }
			});
			const response = await GET({
				params: { key: 'posts/small.mp4' },
				request,
				platform: undefined
			} as never);

			expect(response.status).toBe(416);
			expect(response.headers.get('content-range')).toBe('bytes */3');
		});

		it('retrieves from Cloudflare KV if not present in memory', async () => {
			const data = new Uint8Array([42, 43, 44]);
			const mockPlatform = {
				env: {
					KV: {
						getWithMetadata: vi.fn().mockResolvedValue({
							value: data.buffer,
							metadata: { contentType: 'image/jpeg' }
						})
					}
				}
			} as unknown as App.Platform;

			const request = new Request('http://localhost/api/upload/mock-r2/persisted.jpg');
			const response = await GET({
				params: { key: 'persisted.jpg' },
				request,
				platform: mockPlatform
			} as never);

			expect(response.status).toBe(200);
			expect(response.headers.get('content-type')).toBe('image/jpeg');
			const body = new Uint8Array(await response.arrayBuffer());
			expect(body).toEqual(data);
		});
	});

	describe('HEAD', () => {
		it('returns headers without body for HEAD request', async () => {
			const data = new Uint8Array([1, 2, 3, 4]);
			mockStorage.set('posts/video.mp4', {
				buffer: data.buffer,
				contentType: 'video/mp4'
			});

			const request = new Request('http://localhost/api/upload/mock-r2/posts/video.mp4');
			const response = await HEAD({
				params: { key: 'posts/video.mp4' },
				request,
				platform: undefined
			} as never);

			expect(response.status).toBe(200);
			expect(response.headers.get('accept-ranges')).toBe('bytes');
			expect(response.headers.get('content-length')).toBe('4');
			const body = await response.text();
			expect(body).toBe('');
		});
	});

	describe('OPTIONS', () => {
		it('returns 204 with CORS headers', async () => {
			const response = await OPTIONS({} as never);
			expect(response.status).toBe(204);
			expect(response.headers.get('access-control-allow-origin')).toBe('*');
		});
	});
});

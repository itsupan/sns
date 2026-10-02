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
		const locals = { user: { id: 'user-1' } };

		function put(
			key: string,
			body: BodyInit,
			headers: Record<string, string>,
			opts: { locals?: unknown; platform?: unknown } = {}
		) {
			return PUT({
				params: { key },
				request: new Request(`http://localhost/api/upload/mock-r2/${key}`, {
					method: 'PUT',
					headers,
					body
				}),
				locals: opts.locals ?? locals,
				platform: opts.platform
			} as never);
		}

		it('stores the upload under the uploader’s own key', async () => {
			const data = new Uint8Array([1, 2, 3, 4, 5]);
			const res = await put('posts/user-1/clip.mp4', data, { 'content-type': 'video/mp4' });

			expect(res.status).toBe(200);
			const stored = mockStorage.get('posts/user-1/clip.mp4');
			expect(stored?.contentType).toBe('video/mp4');
			expect(new Uint8Array(stored!.buffer)).toEqual(data);
		});

		it('persists to KV instead of memory when KV is bound', async () => {
			const kvPut = vi.fn().mockResolvedValue(undefined);
			const res = await put(
				'avatars/user-1/me.jpg',
				new Uint8Array([10, 20, 30]),
				{ 'content-type': 'image/jpeg' },
				{ platform: { env: { KV: { put: kvPut, get: vi.fn().mockResolvedValue(null) } } } }
			);

			expect(res.status).toBe(200);
			expect(kvPut).toHaveBeenCalledWith('avatars/user-1/me.jpg', expect.any(ArrayBuffer), {
				metadata: { contentType: 'image/jpeg' }
			});
			expect(mockStorage.has('avatars/user-1/me.jpg')).toBe(false);
		});

		it('rejects anonymous uploads', async () => {
			const res = await put(
				'posts/user-1/a.jpg',
				'x',
				{ 'content-type': 'image/jpeg' },
				{ locals: { user: null } }
			);
			expect(res.status).toBe(401);
			expect(mockStorage.size).toBe(0);
		});

		it.each([
			'posts/user-2/a.jpg',
			'rl:createPost:user-1:0',
			'posts/user-1/../user-2/a.jpg',
			'posts/user-1/..',
			'secrets/user-1/a.jpg',
			'posts/user-1'
		])('rejects writes outside the uploader’s own keys: %s', async (key) => {
			const res = await put(key, 'x', { 'content-type': 'image/jpeg' });
			expect(res.status).toBe(403);
			expect(mockStorage.size).toBe(0);
		});

		it.each(['text/html', 'image/svg+xml', 'application/octet-stream'])(
			'rejects content type %s',
			async (type) => {
				const res = await put('posts/user-1/a.jpg', 'x', { 'content-type': type });
				expect(res.status).toBe(415);
				expect(mockStorage.size).toBe(0);
			}
		);

		it('rejects files over the upload limit', async () => {
			const res = await put(
				'posts/user-1/a.jpg',
				new Uint8Array(4),
				{ 'content-type': 'image/jpeg' },
				{ platform: { env: { UPLOAD_MAX_BYTES: '3' } } }
			);
			expect(res.status).toBe(413);
			expect(mockStorage.size).toBe(0);
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
			expect(response.headers.get('x-content-type-options')).toBe('nosniff');
			expect(response.headers.get('content-security-policy')).toContain('sandbox');
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
			expect(response.headers.get('access-control-allow-methods')).not.toContain('PUT');
		});
	});
});

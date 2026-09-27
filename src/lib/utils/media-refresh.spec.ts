import { describe, it, expect, vi, beforeEach } from 'vitest';
import { refreshExpiredMediaUrl } from './media-refresh';

describe('media-refresh client utility', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('returns data: and blob: URLs unchanged without fetching', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		const dataUrl = 'data:image/png;base64,123';
		const blobUrl = 'blob:http://localhost/123';

		expect(await refreshExpiredMediaUrl(dataUrl)).toBe(dataUrl);
		expect(await refreshExpiredMediaUrl(blobUrl)).toBe(blobUrl);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('calls /api/media/refresh and returns fresh URL on success', async () => {
		const expiredUrl = 'https://bucket.r2.cloudflarestorage.com/photo.jpg?X-Amz-Expires=3600';
		const freshUrl = 'https://cdn.example.com/photo.jpg';

		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
			new Response(JSON.stringify({ refreshed: { [expiredUrl]: freshUrl } }), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			})
		);

		const result = await refreshExpiredMediaUrl(expiredUrl);
		expect(result).toBe(freshUrl);
	});

	it('returns original URL if fetch fails', async () => {
		const expiredUrl = 'https://bucket.r2.cloudflarestorage.com/fail.jpg';
		vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

		const result = await refreshExpiredMediaUrl(expiredUrl);
		expect(result).toBe(expiredUrl);
	});
});

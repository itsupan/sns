import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { getPresignedUploadUrl, uploadToR2 } from './upload';

describe('upload utility', () => {
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		vi.restoreAllMocks();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	describe('getPresignedUploadUrl', () => {
		it('requests presigned URL from backend and returns result', async () => {
			const mockResponse = {
				uploadUrl: 'https://r2.example.com/upload-signed-url',
				publicUrl: 'https://cdn.example.com/avatars/user-123.jpg',
				key: 'avatars/user-123.jpg'
			};

			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => mockResponse
			} as Response);

			const result = await getPresignedUploadUrl({
				name: 'avatar.png',
				type: 'image/png',
				size: 1024
			});

			expect(globalThis.fetch).toHaveBeenCalledWith('/api/upload/presigned', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					filename: 'avatar.png',
					contentType: 'image/png',
					size: 1024
				})
			});

			expect(result).toEqual(mockResponse);
		});

		it('throws an error with message if backend fails', async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 400,
				json: async () => ({ error: 'Invalid MIME type' })
			} as Response);

			await expect(
				getPresignedUploadUrl({
					name: 'doc.pdf',
					type: 'application/pdf',
					size: 1024
				})
			).rejects.toThrow('Invalid MIME type');
		});
	});

	describe('uploadToR2', () => {
		it('rejects disallowed file types', async () => {
			const file = new File(['dummy'], 'document.pdf', { type: 'application/pdf' });

			await expect(uploadToR2(file)).rejects.toThrow('Invalid file type');
		});

		it('rejects file larger than maxSizeMb', async () => {
			const file = new File(['dummy'], 'large.jpg', { type: 'image/jpeg' });
			Object.defineProperty(file, 'size', { value: 15 * 1024 * 1024 }); // 15MB

			await expect(uploadToR2(file, { maxSizeMb: 10 })).rejects.toThrow('File size exceeds');
		});

		it('successfully requests presigned URL and performs PUT request directly to Cloudflare R2', async () => {
			const file = new File(['image-bytes'], 'avatar.jpg', { type: 'image/jpeg' });
			const mockPresigned = {
				uploadUrl: 'https://r2.cloudflarestorage.com/bucket/avatar.jpg?signed=true',
				publicUrl: 'https://cdn.kizuna.com/avatar.jpg',
				key: 'avatars/avatar.jpg'
			};

			const mockFetch = vi
				.fn()
				// First call: POST /api/upload/presigned
				.mockResolvedValueOnce({
					ok: true,
					json: async () => mockPresigned
				} as Response)
				// Second call: PUT to Cloudflare R2
				.mockResolvedValueOnce({
					ok: true,
					status: 200,
					statusText: 'OK'
				} as Response);

			globalThis.fetch = mockFetch;

			const onProgress = vi.fn();
			const result = await uploadToR2(file, { onProgress });

			expect(mockFetch).toHaveBeenCalledTimes(2);
			// Check PUT call to R2
			expect(mockFetch).toHaveBeenNthCalledWith(
				2,
				mockPresigned.uploadUrl,
				expect.objectContaining({
					method: 'PUT',
					headers: { 'Content-Type': 'image/jpeg' },
					body: file
				})
			);

			expect(onProgress).toHaveBeenCalledWith(100);
			expect(result).toEqual(mockPresigned);
		});

		it('throws if direct PUT to Cloudflare R2 fails', async () => {
			const file = new File(['image-bytes'], 'avatar.jpg', { type: 'image/jpeg' });
			const mockPresigned = {
				uploadUrl: 'https://r2.cloudflarestorage.com/bucket/avatar.jpg?signed=true',
				publicUrl: 'https://cdn.kizuna.com/avatar.jpg',
				key: 'avatars/avatar.jpg'
			};

			globalThis.fetch = vi
				.fn()
				.mockResolvedValueOnce({
					ok: true,
					json: async () => mockPresigned
				} as Response)
				.mockResolvedValueOnce({
					ok: false,
					status: 403,
					statusText: 'SignatureDoesNotMatch'
				} as Response);

			await expect(uploadToR2(file)).rejects.toThrow(
				'Direct R2 upload failed with status 403: SignatureDoesNotMatch'
			);
		});
	});
});

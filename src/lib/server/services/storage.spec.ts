import { describe, expect, it, vi } from 'vitest';
import { mockStorage } from './media-storage';
import {
	generatePresignedUploadUrl,
	extractR2Key,
	isPresignedUrlExpired,
	generatePresignedGetUrl,
	refreshMediaUrl,
	refreshPostMediaUrls,
	deleteMediaObjects,
	ownedMediaKeys
} from './storage';

describe('storage service', () => {
	it('rejects unsupported MIME types', async () => {
		await expect(
			generatePresignedUploadUrl(undefined, {
				filename: 'virus.exe',
				contentType: 'application/octet-stream',
				userId: 'user-1'
			})
		).rejects.toThrow('Invalid MIME type');
	});

	it('rejects files exceeding max size limit', async () => {
		await expect(
			generatePresignedUploadUrl(undefined, {
				filename: 'huge.png',
				contentType: 'image/png',
				size: 60 * 1024 * 1024,
				userId: 'user-1'
			})
		).rejects.toThrow('File size exceeds');
	});

	it('generates local mock presigned upload URL when R2 credentials are missing', async () => {
		const result = await generatePresignedUploadUrl(undefined, {
			filename: 'my-avatar.jpg',
			contentType: 'image/jpeg',
			size: 1024,
			userId: 'user-123'
		});

		expect(result.uploadUrl).toContain('/api/upload/mock-r2/avatars/user-123/');
		expect(result.publicUrl).toContain('/api/upload/mock-r2/avatars/user-123/');
		expect(result.key).toMatch(/^avatars\/user-123\/\d+-[a-f0-9-]+\.jpg$/);
	});

	it('generates authentic AWS SigV4 presigned PUT URL when R2 credentials are provided', async () => {
		const mockEnv = {
			R2_ACCOUNT_ID: 'cf-account-id',
			R2_ACCESS_KEY_ID: 'cf-access-key-id',
			R2_SECRET_ACCESS_KEY: 'cf-secret-access-key',
			R2_BUCKET_NAME: 'sns-bucket',
			R2_PUBLIC_URL: 'https://cdn.example.com'
		};

		const result = await generatePresignedUploadUrl(mockEnv as unknown as Env, {
			filename: 'test.png',
			contentType: 'image/png',
			userId: 'user-456'
		});

		expect(result.uploadUrl).toContain(
			'https://cf-account-id.r2.cloudflarestorage.com/sns-bucket/avatars/user-456/'
		);
		expect(result.uploadUrl).toContain('X-Amz-Algorithm=AWS4-HMAC-SHA256');
		expect(result.uploadUrl).toContain('X-Amz-Credential=');
		expect(result.uploadUrl).toContain('X-Amz-Signature=');
		expect(result.publicUrl).toMatch(/^https:\/\/cdn\.example\.com\/avatars\/user-456\//);
		expect(result.key).toMatch(/^avatars\/user-456\/\d+-[a-f0-9-]+\.png$/);
	});

	describe('ownedMediaKeys', () => {
		it("keeps only unique keys under the user's own upload prefix", () => {
			expect(
				ownedMediaKeys(
					[
						'posts/user-1/a.jpg',
						'/api/upload/mock-r2/posts/user-1/a.jpg',
						'posts/user-2/victim.jpg',
						'posts/user-10/b.jpg',
						'https://example.com/elsewhere.jpg'
					],
					'user-1'
				)
			).toEqual(['posts/user-1/a.jpg']);
		});
	});

	describe('extractR2Key', () => {
		it('extracts key from plain relative key string', () => {
			expect(extractR2Key('posts/user-1/photo.jpg')).toBe('posts/user-1/photo.jpg');
			expect(extractR2Key('avatars/user-2/avatar.png')).toBe('avatars/user-2/avatar.png');
		});

		it('extracts key from mock-r2 URL', () => {
			expect(extractR2Key('/api/upload/mock-r2/posts/user-1/photo.jpg')).toBe(
				'posts/user-1/photo.jpg'
			);
			expect(
				extractR2Key('https://sns.ecoapsara.com/api/upload/mock-r2/posts/user-1/video.mp4')
			).toBe('posts/user-1/video.mp4');
		});

		it('extracts key from media proxy URL', () => {
			expect(extractR2Key('/api/media/posts/user-1/photo.jpg')).toBe('posts/user-1/photo.jpg');
			expect(extractR2Key('https://sns.ecoapsara.com/api/media/posts/user-1/photo.jpg')).toBe(
				'posts/user-1/photo.jpg'
			);
		});

		it('extracts key from Cloudflare R2 S3 URLs with query parameters', () => {
			const s3Url =
				'https://cf-acc.r2.cloudflarestorage.com/sns-media/posts/user-1/photo.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=3600';
			expect(extractR2Key(s3Url)).toBe('posts/user-1/photo.jpg');
		});

		it('returns null for non-R2 external URLs', () => {
			expect(extractR2Key('https://images.unsplash.com/photo-1513694203232')).toBeNull();
		});
	});

	describe('isPresignedUrlExpired', () => {
		it('returns false for regular non-presigned URLs', () => {
			expect(isPresignedUrlExpired('https://cdn.example.com/photo.jpg')).toBe(false);
			expect(isPresignedUrlExpired('/api/media/posts/photo.jpg')).toBe(false);
			expect(isPresignedUrlExpired('/api/upload/mock-r2/posts/photo.jpg')).toBe(false);
		});

		it('returns true for past expired AWS presigned URLs', () => {
			const pastUrl =
				'https://bucket.acc.r2.cloudflarestorage.com/photo.jpg?X-Amz-Date=20200101T000000Z&X-Amz-Expires=3600';
			expect(isPresignedUrlExpired(pastUrl)).toBe(true);
		});

		it('returns false for future valid AWS presigned URLs', () => {
			const futureUrl =
				'https://bucket.acc.r2.cloudflarestorage.com/photo.jpg?X-Amz-Date=20990101T000000Z&X-Amz-Expires=86400';
			expect(isPresignedUrlExpired(futureUrl)).toBe(false);
		});

		it('returns true for raw unauthenticated R2 cloudflarestorage.com endpoints', () => {
			const rawS3Url = 'https://bucket.acc.r2.cloudflarestorage.com/posts/photo.jpg';
			expect(isPresignedUrlExpired(rawS3Url)).toBe(true);
		});
	});

	describe('generatePresignedGetUrl', () => {
		it('returns permanent public CDN URL if R2_PUBLIC_URL is configured', async () => {
			const env = { R2_PUBLIC_URL: 'https://cdn.example.com' };
			const result = await generatePresignedGetUrl(env, 'posts/user-1/pic.webp');
			expect(result).toBe('https://cdn.example.com/posts/user-1/pic.webp');
		});

		it('generates authentic presigned GET URL when credentials are present', async () => {
			const env = {
				R2_ACCOUNT_ID: 'cf-acc',
				R2_ACCESS_KEY_ID: 'cf-key',
				R2_SECRET_ACCESS_KEY: 'cf-sec',
				R2_BUCKET_NAME: 'sns-bucket'
			};
			const result = await generatePresignedGetUrl(env, 'posts/user-1/video.mp4');
			expect(result).toContain(
				'https://cf-acc.r2.cloudflarestorage.com/sns-bucket/posts/user-1/video.mp4'
			);
			expect(result).toContain('X-Amz-Signature=');
			expect(result).toContain('X-Amz-Expires=');
		});

		it('falls back to /api/media proxy when credentials are missing', async () => {
			const result = await generatePresignedGetUrl(undefined, 'posts/user-1/video.mp4');
			expect(result).toBe('/api/media/posts/user-1/video.mp4');
		});
	});

	describe('refreshMediaUrl and refreshPostMediaUrls', () => {
		it('refreshes a single expired media URL', async () => {
			const expiredUrl =
				'https://bucket.acc.r2.cloudflarestorage.com/posts/u1/photo.jpg?X-Amz-Date=20200101T000000Z&X-Amz-Expires=3600';
			const refreshed = await refreshMediaUrl(expiredUrl, {
				R2_PUBLIC_URL: 'https://cdn.example.com'
			});
			expect(refreshed).toBe('https://cdn.example.com/posts/u1/photo.jpg');

			const unchanged = await refreshMediaUrl('https://images.unsplash.com/photo-123', undefined);
			expect(unchanged).toBe('https://images.unsplash.com/photo-123');
		});

		it('refreshes expired presigned URLs in post data', async () => {
			const expiredUrl =
				'https://bucket.acc.r2.cloudflarestorage.com/posts/u1/photo.jpg?X-Amz-Date=20200101T000000Z&X-Amz-Expires=3600';
			const validUrl = 'https://images.unsplash.com/photo-123';

			const mockPost = {
				id: 'post-1',
				author: {
					name: 'Elena',
					avatar: expiredUrl
				},
				title: 'Post',
				description: 'Desc',
				image: expiredUrl,
				mediaUrl: expiredUrl,
				mediaItems: [
					{ url: expiredUrl, type: 'image' as const },
					{ url: validUrl, type: 'image' as const }
				]
			};

			const refreshed = await refreshPostMediaUrls(mockPost, {
				R2_PUBLIC_URL: 'https://cdn.example.com'
			});

			expect(refreshed.image).toBe('https://cdn.example.com/posts/u1/photo.jpg');
			expect(refreshed.mediaUrl).toBe('https://cdn.example.com/posts/u1/photo.jpg');
			expect(refreshed.author.avatar).toBe('https://cdn.example.com/posts/u1/photo.jpg');
			expect(refreshed.mediaItems[0].url).toBe('https://cdn.example.com/posts/u1/photo.jpg');
			expect(refreshed.mediaItems[1].url).toBe(validUrl);
		});
	});
});

describe('deleteMediaObjects', () => {
	it('deletes through the R2 binding, KV and in-memory storage', async () => {
		const r2Delete = vi.fn(async () => undefined);
		const kvDelete = vi.fn(async () => undefined);
		mockStorage.set('posts/u/a.jpg', { buffer: new ArrayBuffer(1), contentType: 'image/jpeg' });
		const env = { R2_BUCKET: { delete: r2Delete }, KV: { delete: kvDelete } } as unknown as Env;

		await deleteMediaObjects(['posts/u/a.jpg', 'posts/u/b.jpg'], env);

		expect(r2Delete).toHaveBeenCalledWith(['posts/u/a.jpg', 'posts/u/b.jpg']);
		expect(kvDelete).toHaveBeenCalledTimes(2);
		expect(mockStorage.has('posts/u/a.jpg')).toBe(false);
	});

	it('deletes KV copies when no R2 binding or credentials exist', async () => {
		const kvDelete = vi.fn(async () => undefined);
		await deleteMediaObjects(['posts/u/c.png'], { KV: { delete: kvDelete } } as unknown as Env);
		expect(kvDelete).toHaveBeenCalledWith('posts/u/c.png');
	});

	it('never throws when deletes fail', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		const env = {
			R2_BUCKET: { delete: vi.fn(async () => Promise.reject(new Error('r2 down'))) },
			KV: { delete: vi.fn(async () => Promise.reject(new Error('kv down'))) }
		} as unknown as Env;
		await expect(deleteMediaObjects(['posts/u/d.jpg'], env)).resolves.toBeUndefined();
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
		error.mockRestore();
	});
});

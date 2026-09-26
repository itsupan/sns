import { describe, expect, it } from 'vitest';
import { generatePresignedUploadUrl } from './storage';

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
				size: 20 * 1024 * 1024,
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
});

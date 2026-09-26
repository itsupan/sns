import { AwsClient } from 'aws4fetch';

export interface PresignedUrlOptions {
	filename: string;
	contentType: string;
	size?: number;
	userId: string;
	prefix?: string;
}

export interface PresignedUrlResult {
	uploadUrl: string;
	publicUrl: string;
	key: string;
}

const ALLOWED_MIME_TYPES = new Set([
	'image/jpeg',
	'image/png',
	'image/webp',
	'image/gif',
	'image/avif'
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Validates upload parameters and generates a presigned PUT URL for Cloudflare R2.
 * When R2 credentials are not present (e.g. local dev / test), falls back to
 * a local mock endpoint so uploads can be tested end-to-end without external services.
 */
export async function generatePresignedUploadUrl(
	env: Partial<Env> | undefined,
	options: PresignedUrlOptions
): Promise<PresignedUrlResult> {
	const { filename, contentType, size, userId, prefix = 'avatars' } = options;

	// Validate content type
	if (!ALLOWED_MIME_TYPES.has(contentType)) {
		throw new Error(
			`Invalid MIME type: "${contentType}". Allowed types: ${Array.from(ALLOWED_MIME_TYPES).join(', ')}`
		);
	}

	// Validate size if provided
	if (size !== undefined && size > MAX_FILE_SIZE_BYTES) {
		throw new Error(
			`File size exceeds maximum allowed limit of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`
		);
	}

	// Generate a safe unique key
	const rawExt = filename.split('.').pop()?.toLowerCase() || 'jpg';
	const safeExt = /^[a-z0-9]+$/i.test(rawExt) ? rawExt : 'jpg';
	const key = `${prefix}/${userId}/${Date.now()}-${crypto.randomUUID()}.${safeExt}`;

	const accountId = env?.R2_ACCOUNT_ID;
	const accessKeyId = env?.R2_ACCESS_KEY_ID;
	const secretAccessKey = env?.R2_SECRET_ACCESS_KEY;
	const bucketName = env?.R2_BUCKET_NAME;

	// If R2 credentials are fully configured, generate authentic AWS SigV4 presigned PUT URL
	if (accountId && accessKeyId && secretAccessKey && bucketName) {
		const aws = new AwsClient({
			accessKeyId,
			secretAccessKey,
			service: 's3',
			region: 'auto'
		});

		const s3Endpoint = `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${key}`;
		const request = new Request(s3Endpoint, {
			method: 'PUT',
			headers: {
				'Content-Type': contentType
			}
		});

		const signed = await aws.sign(request, {
			aws: {
				signQuery: true,
				allHeaders: false
			}
		});

		const publicUrl = env?.R2_PUBLIC_URL
			? `${env.R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`
			: `https://${bucketName}.${accountId}.r2.cloudflarestorage.com/${key}`;

		return {
			uploadUrl: signed.url,
			publicUrl,
			key
		};
	}

	// Local development and testing fallback:
	// Returns a working local mock PUT endpoint URL so direct PUT requests work seamlessly
	const mockUrl = `/api/upload/mock-r2/${key}`;
	return {
		uploadUrl: mockUrl,
		publicUrl: mockUrl,
		key
	};
}

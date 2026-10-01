import { AwsClient } from 'aws4fetch';
import { getConfig } from '$lib/server/config';
import { mockStorage } from './media-storage';

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

function formatMegabytes(bytes: number): string {
	return String(Math.round((bytes / (1024 * 1024)) * 10) / 10);
}

export function isValidCredential(val: string | undefined): boolean {
	return Boolean(val && val.trim() !== '' && !val.includes('replace-me'));
}

/**
 * Extracts the canonical R2 object key from any R2 URL, presigned URL, or proxy URL.
 * Returns null if the URL is not an R2 resource (e.g. Unsplash or third-party image).
 */
export function extractR2Key(urlOrKey: string | undefined | null): string | null {
	if (!urlOrKey || typeof urlOrKey !== 'string') return null;

	let path = urlOrKey.trim();

	// If it's a full URL, parse pathname
	if (path.startsWith('http://') || path.startsWith('https://')) {
		try {
			const parsed = new URL(path);
			// Check if host is third-party (e.g. unsplash, googleusercontent, etc.)
			const isR2Host =
				parsed.hostname.includes('r2.cloudflarestorage.com') ||
				parsed.hostname.includes('.r2.dev') ||
				parsed.pathname.includes('/api/upload/mock-r2/') ||
				parsed.pathname.includes('/api/media/') ||
				parsed.searchParams.has('X-Amz-Signature');

			const knownPrefix = /(?:^|\/)((?:posts|avatars|stories|media|uploads)\/.+)$/.test(
				parsed.pathname
			);

			if (!isR2Host && !knownPrefix) {
				return null;
			}

			path = decodeURIComponent(parsed.pathname);
		} catch {
			return null;
		}
	} else if (path.includes('?')) {
		path = path.split('?')[0];
	}

	// Remove leading slashes
	path = path.replace(/^\/+/, '');

	// Strip known internal proxy prefixes
	if (path.startsWith('api/upload/mock-r2/')) {
		return path.replace(/^api\/upload\/mock-r2\//, '');
	}

	if (path.startsWith('api/media/')) {
		return path.replace(/^api\/media\//, '');
	}

	// Match key starting with standard prefixes (posts/, avatars/, etc.) even if bucket prefix is present
	const match = path.match(/(?:^|\/)((?:posts|avatars|stories|media|uploads)\/[^?#]+)$/);
	if (match) {
		return match[1];
	}

	// Fallback check for safe key pattern with file extension
	if (/^[a-zA-Z0-9_./-]+\.[a-zA-Z0-9]+$/.test(path)) {
		return path;
	}

	return null;
}

/**
 * Checks whether an AWS SigV4 / Cloudflare R2 presigned URL is expired or close to expiring.
 * Also marks unauthenticated raw private S3 endpoints as needing a fresh signed URL.
 */
/**
 * Unique storage keys from post media URLs that sit under `userId`'s own upload prefix
 * (`<prefix>/<userId>/...`, see generatePresignedUploadUrl). Media URLs are author-supplied,
 * so anything else must never be deleted on that user's behalf.
 */
export function ownedMediaKeys(urls: string[], userId: string): string[] {
	const keys = new Set<string>();
	for (const url of urls) {
		const key = extractR2Key(url);
		if (key && key.split('/')[1] === userId) keys.add(key);
	}
	return [...keys];
}

export function isPresignedUrlExpired(
	urlStr: string | undefined | null,
	marginMs = 60000
): boolean {
	if (!urlStr || typeof urlStr !== 'string') return false;

	try {
		const parsed = new URL(urlStr, 'http://localhost');
		const expiresParam = parsed.searchParams.get('X-Amz-Expires');
		const dateParam = parsed.searchParams.get('X-Amz-Date');

		if (!expiresParam || !dateParam) {
			// If it's a raw private S3 endpoint without signature or public URL, it will fail direct browser access
			if (parsed.hostname.includes('r2.cloudflarestorage.com')) {
				return true;
			}
			return false;
		}

		// Parse X-Amz-Date: format YYYYMMDDTHHMMSSZ (e.g. 20260927T104500Z)
		const year = parseInt(dateParam.slice(0, 4), 10);
		const month = parseInt(dateParam.slice(4, 6), 10) - 1;
		const day = parseInt(dateParam.slice(6, 8), 10);
		const hour = parseInt(dateParam.slice(9, 11), 10);
		const min = parseInt(dateParam.slice(11, 13), 10);
		const sec = parseInt(dateParam.slice(13, 15), 10);

		const createdTime = Date.UTC(year, month, day, hour, min, sec);
		const expiresSec = parseInt(expiresParam, 10);
		const expireTime = createdTime + expiresSec * 1000;

		return Date.now() >= expireTime - marginMs;
	} catch {
		return false;
	}
}

/**
 * Generates an authentic AWS SigV4 presigned GET URL for an R2 key with 7-day expiration,
 * or returns a permanent public/proxy URL.
 */
export async function generatePresignedGetUrl(
	env: Partial<Env> | undefined,
	key: string,
	expiresSeconds = getConfig(env).mediaUrlTtlSec
): Promise<string> {
	// If R2_PUBLIC_URL is configured, prefer the permanent public CDN URL
	if (env?.R2_PUBLIC_URL && isValidCredential(env.R2_PUBLIC_URL)) {
		return `${env.R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
	}

	const accountId = env?.R2_ACCOUNT_ID;
	const accessKeyId = env?.R2_ACCESS_KEY_ID;
	const secretAccessKey = env?.R2_SECRET_ACCESS_KEY;
	const bucketName = env?.R2_BUCKET_NAME;

	const hasValidR2Credentials =
		isValidCredential(accountId) &&
		isValidCredential(accessKeyId) &&
		isValidCredential(secretAccessKey) &&
		isValidCredential(bucketName);

	if (hasValidR2Credentials && accountId && accessKeyId && secretAccessKey && bucketName) {
		const aws = new AwsClient({
			accessKeyId,
			secretAccessKey,
			service: 's3',
			region: 'auto'
		});

		const s3Endpoint = `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${key}`;
		const request = new Request(s3Endpoint, { method: 'GET' });

		const signed = await aws.sign(request, {
			aws: {
				signQuery: true,
				allHeaders: false
			}
		});

		// By default aws.sign sets 86400 (24h). We can override X-Amz-Expires query param if within 7 days
		const signedUrl = new URL(signed.url);
		if (expiresSeconds > 0 && expiresSeconds <= 7 * 24 * 3600) {
			signedUrl.searchParams.set('X-Amz-Expires', expiresSeconds.toString());
		}

		return signedUrl.toString();
	}

	// Permanent media proxy fallback
	return `/api/media/${key}`;
}

/**
 * Refreshes an expired presigned URL or generates a permanent URL for a given media URL or key.
 */
export async function refreshMediaUrl(urlOrKey: string, env?: Partial<Env>): Promise<string> {
	const key = extractR2Key(urlOrKey);
	if (!key) return urlOrKey;

	// If not expired and not a private unauthenticated endpoint, keep it
	if (!isPresignedUrlExpired(urlOrKey)) {
		return urlOrKey;
	}

	return generatePresignedGetUrl(env, key);
}

/**
 * Inspects a post object and automatically refreshes all expired presigned URLs before rendering or returning API response.
 */
export async function refreshPostMediaUrls<T extends object>(
	postData: T,
	env?: Partial<Env>
): Promise<T> {
	if (!postData) return postData;

	const record = postData as Record<string, unknown>;
	const updated: Record<string, unknown> = { ...record };

	if (typeof updated.mediaUrl === 'string' && isPresignedUrlExpired(updated.mediaUrl)) {
		updated.mediaUrl = await refreshMediaUrl(updated.mediaUrl, env);
	}

	if (typeof updated.image === 'string' && isPresignedUrlExpired(updated.image)) {
		updated.image = await refreshMediaUrl(updated.image, env);
	}

	if (Array.isArray(updated.mediaItems) && updated.mediaItems.length > 0) {
		updated.mediaItems = await Promise.all(
			updated.mediaItems.map(
				async (item: { url?: string; type?: 'image' | 'video'; [key: string]: unknown }) => {
					if (item?.url && isPresignedUrlExpired(item.url)) {
						const freshUrl = await refreshMediaUrl(item.url, env);
						return { ...item, url: freshUrl };
					}
					return item;
				}
			)
		);
	}

	if (
		updated.author &&
		typeof updated.author === 'object' &&
		'avatar' in updated.author &&
		typeof (updated.author as { avatar?: unknown }).avatar === 'string' &&
		isPresignedUrlExpired((updated.author as { avatar: string }).avatar)
	) {
		const authorObj = updated.author as Record<string, unknown>;
		const freshAvatar = await refreshMediaUrl(authorObj.avatar as string, env);
		updated.author = { ...authorObj, avatar: freshAvatar };
	}

	return updated as T;
}

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
	const { allowedMimeTypes, maxBytes } = getConfig(env).upload;

	// Validate content type
	if (!allowedMimeTypes.has(contentType)) {
		throw new Error(
			`Invalid MIME type: "${contentType}". Allowed types: ${Array.from(allowedMimeTypes).join(', ')}`
		);
	}

	// Validate size if provided
	if (size !== undefined && size > maxBytes) {
		throw new Error(`File size exceeds maximum allowed limit of ${formatMegabytes(maxBytes)}MB`);
	}

	// Generate a safe unique key
	const rawExt = filename.split('.').pop()?.toLowerCase() || 'jpg';
	const safeExt = /^[a-z0-9]+$/i.test(rawExt) ? rawExt : 'jpg';
	const key = `${prefix}/${userId}/${Date.now()}-${crypto.randomUUID()}.${safeExt}`;

	const accountId = env?.R2_ACCOUNT_ID;
	const accessKeyId = env?.R2_ACCESS_KEY_ID;
	const secretAccessKey = env?.R2_SECRET_ACCESS_KEY;
	const bucketName = env?.R2_BUCKET_NAME;

	const hasValidR2Credentials =
		isValidCredential(accountId) &&
		isValidCredential(accessKeyId) &&
		isValidCredential(secretAccessKey) &&
		isValidCredential(bucketName);

	// If real R2 credentials are fully configured, generate authentic AWS SigV4 presigned PUT URL
	if (hasValidR2Credentials && accountId && accessKeyId && secretAccessKey && bucketName) {
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

		const publicUrl =
			env?.R2_PUBLIC_URL && isValidCredential(env.R2_PUBLIC_URL)
				? `${env.R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`
				: `/api/media/${key}`;

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

/** The native R2 binding, under whichever name the media proxy also accepts. */
function r2Binding(
	env: Partial<Env> | undefined
): { delete: (keys: string[]) => Promise<void> } | null {
	const bindings = env as Record<string, unknown> | undefined;
	const r2 = bindings?.R2_BUCKET || bindings?.MEDIA_BUCKET || bindings?.BUCKET;
	return r2 && typeof (r2 as { delete?: unknown }).delete === 'function'
		? (r2 as { delete: (keys: string[]) => Promise<void> })
		: null;
}

/**
 * Deletes objects from our bucket: through the R2 binding, else the S3 API when credentials are
 * configured, else the local mock store. Returns the keys that could not be deleted; never throws.
 */
export async function deleteR2Objects(
	env: Partial<Env> | undefined,
	keys: string[]
): Promise<string[]> {
	const unique = [...new Set(keys)];
	if (unique.length === 0) return [];

	const binding = r2Binding(env);
	if (binding) {
		const failed: string[] = [];
		// R2 deletes at most 1000 keys per call.
		for (let i = 0; i < unique.length; i += 1000) {
			const batch = unique.slice(i, i + 1000);
			try {
				await binding.delete(batch);
			} catch (err) {
				console.error('R2 delete failed', err);
				failed.push(...batch);
			}
		}
		return failed;
	}

	const accountId = env?.R2_ACCOUNT_ID;
	const accessKeyId = env?.R2_ACCESS_KEY_ID;
	const secretAccessKey = env?.R2_SECRET_ACCESS_KEY;
	const bucketName = env?.R2_BUCKET_NAME;
	if (
		accountId &&
		accessKeyId &&
		secretAccessKey &&
		bucketName &&
		isValidCredential(accountId) &&
		isValidCredential(accessKeyId) &&
		isValidCredential(secretAccessKey) &&
		isValidCredential(bucketName)
	) {
		const aws = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' });
		const results = await Promise.all(
			unique.map(async (key) => {
				const path = key.split('/').map(encodeURIComponent).join('/');
				try {
					const res = await aws.fetch(
						`https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${path}`,
						{ method: 'DELETE' }
					);
					// S3 answers 204 for deleted and for already-missing keys.
					if (res.ok || res.status === 404) return null;
					console.error(`R2 delete of ${key} failed: HTTP ${res.status}`);
				} catch (err) {
					console.error(`R2 delete of ${key} failed`, err);
				}
				return key;
			})
		);
		return results.filter((k): k is string => k !== null);
	}

	for (const key of unique) mockStorage.delete(key);
	return [];
}

/**
 * Removes a deleted post's media everywhere the media proxy may serve it from: the bucket
 * (via deleteR2Objects), the KV copy and the in-memory dev store. Never throws.
 */
export async function deleteMediaObjects(keys: string[], env?: Partial<Env>): Promise<void> {
	const unique = [...new Set(keys)];
	if (unique.length === 0) return;

	const failed = await deleteR2Objects(env, unique);
	if (failed.length > 0) console.warn('[storage] Failed to delete media objects:', failed);

	await Promise.all(
		unique.map(async (key) => {
			mockStorage.delete(key);
			try {
				await env?.KV?.delete(key);
			} catch (err) {
				console.warn(`[storage] Failed to delete KV media copy ${key}:`, err);
			}
		})
	);
}

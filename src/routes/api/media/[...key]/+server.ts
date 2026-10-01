import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { mockStorage, inferContentType, parseRange } from '$lib/server/services/media-storage';
import { isValidCredential } from '$lib/server/services/storage';
import { AwsClient } from 'aws4fetch';

const CORS_HEADERS: Record<string, string> = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, HEAD, PUT, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Range, Authorization',
	'Access-Control-Expose-Headers':
		'Content-Range, Accept-Ranges, Content-Length, Content-Type, ETag'
};

export const OPTIONS: RequestHandler = async () => {
	return new Response(null, {
		status: 204,
		headers: {
			...CORS_HEADERS
		}
	});
};

export const PUT: RequestHandler = async ({ params, request, platform }) => {
	const key = params.key;
	if (!key) {
		throw error(400, 'Missing object key');
	}

	const rawContentType = request.headers.get('content-type');
	const contentType =
		rawContentType && rawContentType !== 'application/octet-stream'
			? rawContentType
			: inferContentType(key);

	const arrayBuffer = await request.arrayBuffer();

	mockStorage.set(key, {
		buffer: arrayBuffer,
		contentType
	});

	const kv = platform?.env?.KV;
	if (kv && arrayBuffer.byteLength <= 25 * 1024 * 1024) {
		try {
			await kv.put(key, arrayBuffer, {
				metadata: { contentType }
			});
		} catch (err) {
			console.warn('[media-proxy] Failed to persist file to KV:', err);
		}
	}

	const r2 =
		(platform?.env as Record<string, unknown> | undefined)?.R2_BUCKET ||
		(platform?.env as Record<string, unknown> | undefined)?.MEDIA_BUCKET ||
		(platform?.env as Record<string, unknown> | undefined)?.BUCKET;

	if (r2 && typeof (r2 as { put?: unknown }).put === 'function') {
		try {
			await (r2 as { put: (k: string, b: ArrayBuffer, o?: unknown) => Promise<unknown> }).put(
				key,
				arrayBuffer,
				{
					httpMetadata: { contentType }
				}
			);
		} catch (err) {
			console.warn('[media-proxy] Failed to persist file to R2 bucket:', err);
		}
	}

	return new Response(null, {
		status: 200,
		headers: {
			ETag: `"media-${Date.now()}"`,
			...CORS_HEADERS
		}
	});
};

export const GET: RequestHandler = async ({ params, request, platform }) => {
	const key = params.key;
	if (!key) {
		throw error(400, 'Missing object key');
	}

	const env = platform?.env;

	// 1. If public CDN URL is configured, redirect immediately
	if (env?.R2_PUBLIC_URL && isValidCredential(env.R2_PUBLIC_URL)) {
		return new Response(null, {
			status: 302,
			headers: {
				Location: `${env.R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`,
				'Cache-Control': 'public, max-age=86400',
				...CORS_HEADERS
			}
		});
	}

	// 2. Native Cloudflare R2 bucket binding
	const r2 =
		(platform?.env as Record<string, unknown> | undefined)?.R2_BUCKET ||
		(platform?.env as Record<string, unknown> | undefined)?.MEDIA_BUCKET ||
		(platform?.env as Record<string, unknown> | undefined)?.BUCKET;

	if (r2 && typeof (r2 as { get?: unknown }).get === 'function') {
		try {
			const r2Obj = await (
				r2 as {
					get: (
						k: string,
						opts?: { range?: Headers }
					) => Promise<{
						body: ReadableStream;
						size: number;
						range?: { offset: number; length: number };
						httpMetadata?: { contentType?: string };
						writeHttpMetadata: (headers: Headers) => void;
					} | null>;
				}
			).get(key, { range: request.headers });

			if (r2Obj) {
				const responseHeaders = new Headers(CORS_HEADERS);
				r2Obj.writeHttpMetadata(responseHeaders);
				responseHeaders.set('Accept-Ranges', 'bytes');
				responseHeaders.set('Cache-Control', 'public, max-age=3600');

				if (r2Obj.range) {
					responseHeaders.set(
						'Content-Range',
						`bytes ${r2Obj.range.offset}-${r2Obj.range.offset + r2Obj.range.length - 1}/${r2Obj.size}`
					);
					return new Response(r2Obj.body, {
						status: 206,
						headers: responseHeaders
					});
				}

				return new Response(r2Obj.body, {
					status: 200,
					headers: responseHeaders
				});
			}
		} catch (err) {
			console.warn('[media-proxy] Error reading from R2 binding:', err);
		}
	}

	// 3. AWS SigV4 signed GET request to R2 S3 API
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
		try {
			const aws = new AwsClient({
				accessKeyId: accessKeyId!,
				secretAccessKey: secretAccessKey!,
				service: 's3',
				region: 'auto'
			});

			const s3Endpoint = `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${key}`;
			const signed = await aws.sign(new Request(s3Endpoint, { method: 'GET' }), {
				aws: { signQuery: true, allHeaders: false }
			});

			// Redirect browser to freshly signed GET URL (valid for 24h)
			return new Response(null, {
				status: 302,
				headers: {
					Location: signed.url,
					'Cache-Control': 'private, max-age=3600',
					...CORS_HEADERS
				}
			});
		} catch (err) {
			console.warn('[media-proxy] Error signing R2 S3 request:', err);
		}
	}

	// 4. In-memory buffer or KV
	let item = mockStorage.get(key);

	if (!item && env?.KV) {
		try {
			const res = await env.KV.getWithMetadata<{ contentType?: string }>(key, {
				type: 'arrayBuffer'
			});
			if (res.value) {
				const contentType = res.metadata?.contentType || inferContentType(key);
				item = { buffer: res.value, contentType };
				mockStorage.set(key, item);
			}
		} catch (err) {
			console.warn('[media-proxy] Error reading from KV:', err);
		}
	}

	if (!item) {
		return new Response('Media not found', {
			status: 404,
			headers: {
				'Content-Type': 'text/plain',
				...CORS_HEADERS
			}
		});
	}

	const totalSize = item.buffer.byteLength;
	const rangeHeader = request.headers.get('range');
	const range = parseRange(rangeHeader, totalSize);

	if (range === 'invalid') {
		return new Response(null, {
			status: 416,
			headers: {
				'Content-Range': `bytes */${totalSize}`,
				'Accept-Ranges': 'bytes',
				...CORS_HEADERS
			}
		});
	}

	if (range !== null) {
		const { start, end } = range;
		const slicedBuffer = item.buffer.slice(start, end + 1);
		const chunkSize = end - start + 1;

		return new Response(slicedBuffer, {
			status: 206,
			headers: {
				'Content-Type': item.contentType,
				'Content-Range': `bytes ${start}-${end}/${totalSize}`,
				'Accept-Ranges': 'bytes',
				'Content-Length': chunkSize.toString(),
				'Cache-Control': 'public, max-age=3600',
				...CORS_HEADERS
			}
		});
	}

	return new Response(item.buffer, {
		status: 200,
		headers: {
			'Content-Type': item.contentType,
			'Accept-Ranges': 'bytes',
			'Content-Length': totalSize.toString(),
			'Cache-Control': 'public, max-age=3600',
			...CORS_HEADERS
		}
	});
};

export const HEAD: RequestHandler = async ({ params, request }) => {
	const key = params.key;
	if (!key) {
		throw error(400, 'Missing object key');
	}

	const item = mockStorage.get(key);
	if (!item) {
		return new Response(null, {
			status: 404,
			headers: {
				'Content-Type': 'text/plain',
				...CORS_HEADERS
			}
		});
	}

	const totalSize = item.buffer.byteLength;
	const rangeHeader = request.headers.get('range');
	const range = parseRange(rangeHeader, totalSize);

	if (range === 'invalid') {
		return new Response(null, {
			status: 416,
			headers: {
				'Content-Range': `bytes */${totalSize}`,
				'Accept-Ranges': 'bytes',
				...CORS_HEADERS
			}
		});
	}

	if (range !== null) {
		const { start, end } = range;
		const chunkSize = end - start + 1;
		return new Response(null, {
			status: 206,
			headers: {
				'Content-Type': item.contentType,
				'Content-Range': `bytes ${start}-${end}/${totalSize}`,
				'Accept-Ranges': 'bytes',
				'Content-Length': chunkSize.toString(),
				'Cache-Control': 'public, max-age=3600',
				...CORS_HEADERS
			}
		});
	}

	return new Response(null, {
		status: 200,
		headers: {
			'Content-Type': item.contentType,
			'Accept-Ranges': 'bytes',
			'Content-Length': totalSize.toString(),
			'Cache-Control': 'public, max-age=3600',
			...CORS_HEADERS
		}
	});
};

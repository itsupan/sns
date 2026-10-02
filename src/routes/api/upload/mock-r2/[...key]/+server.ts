import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import {
	MEDIA_HEADERS,
	mockStorage,
	inferContentType,
	parseRange
} from '$lib/server/services/media-storage';
import { isUploadKeyOf } from '$lib/server/services/storage';
import { getConfig } from '$lib/server/config';
import { ApiError, enforceRateLimit, requireUser, withApi } from '$lib/server/api';

const KV_MAX_VALUE_BYTES = 25 * 1024 * 1024;

export const OPTIONS: RequestHandler = async () => {
	return new Response(null, {
		status: 204,
		headers: {
			...MEDIA_HEADERS
		}
	});
};

export const PUT: RequestHandler = withApi(async ({ params, request, locals, platform }) => {
	const user = requireUser(locals);
	if (!isUploadKeyOf(params.key, user.id)) {
		throw new ApiError(403, 'forbidden', 'You can only upload to your own media keys');
	}
	await enforceRateLimit(platform, 'upload', user.id);

	const { maxBytes, allowedMimeTypes } = getConfig(platform?.env).upload;
	const contentType = request.headers.get('content-type') ?? '';
	if (!allowedMimeTypes.has(contentType)) {
		throw new ApiError(415, 'unsupported_media_type', `Unsupported media type "${contentType}"`);
	}

	const kv = platform?.env?.KV;
	const limit = kv ? Math.min(maxBytes, KV_MAX_VALUE_BYTES) : maxBytes;
	if (Number(request.headers.get('content-length')) > limit) {
		throw new ApiError(413, 'payload_too_large', 'File is too large');
	}
	const buffer = await request.arrayBuffer();
	if (buffer.byteLength > limit) {
		throw new ApiError(413, 'payload_too_large', 'File is too large');
	}

	if (kv) {
		await kv.put(params.key, buffer, { metadata: { contentType } });
	} else {
		mockStorage.set(params.key, { buffer, contentType });
	}

	return new Response(null, { status: 200, headers: { ETag: `"${crypto.randomUUID()}"` } });
});

async function getStoredItem(
	key: string,
	platform?: App.Platform
): Promise<{ buffer: ArrayBuffer; contentType: string } | null> {
	// 1. Check in-memory store first
	const item = mockStorage.get(key);
	if (item) return item;

	// 2. Check Cloudflare KV
	const kv = platform?.env?.KV;
	if (kv) {
		try {
			const res = await kv.getWithMetadata<{ contentType?: string }>(key, { type: 'arrayBuffer' });
			if (res.value) {
				const contentType = res.metadata?.contentType || inferContentType(key);
				return { buffer: res.value, contentType };
			}
		} catch (err) {
			console.warn('[mock-r2] Error reading from KV:', err);
		}
	}

	// 3. Check R2 bucket if bound
	const r2 =
		(platform?.env as Record<string, unknown> | undefined)?.R2_BUCKET ||
		(platform?.env as Record<string, unknown> | undefined)?.MEDIA_BUCKET ||
		(platform?.env as Record<string, unknown> | undefined)?.BUCKET;

	if (r2 && typeof (r2 as { get?: unknown }).get === 'function') {
		try {
			const r2Obj = await (
				r2 as {
					get: (k: string) => Promise<{
						arrayBuffer: () => Promise<ArrayBuffer>;
						httpMetadata?: { contentType?: string };
					} | null>;
				}
			).get(key);
			if (r2Obj) {
				const buffer = await r2Obj.arrayBuffer();
				const contentType = r2Obj.httpMetadata?.contentType || inferContentType(key);
				return { buffer, contentType };
			}
		} catch (err) {
			console.warn('[mock-r2] Error reading from R2 bucket:', err);
		}
	}

	return null;
}

export const GET: RequestHandler = async ({ params, request, platform }) => {
	const key = params.key;
	if (!key) {
		throw error(400, 'Missing object key');
	}

	const item = await getStoredItem(key, platform);

	if (!item) {
		// Never return an SVG to a video request or client expecting video/raw media!
		// Return 404 Not Found so browsers and crawlers can accurately handle missing media.
		return new Response('File not found', {
			status: 404,
			headers: {
				'Content-Type': 'text/plain',
				...MEDIA_HEADERS
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
				...MEDIA_HEADERS
			}
		});
	}

	// Range request: standard HTTP 206 Partial Content (mandatory for Safari / iOS WebKit video streaming)
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
				'Cache-Control': 'public, max-age=31536000, immutable',
				...MEDIA_HEADERS
			}
		});
	}

	// Full content: 200 OK
	return new Response(item.buffer, {
		status: 200,
		headers: {
			'Content-Type': item.contentType,
			'Accept-Ranges': 'bytes',
			'Content-Length': totalSize.toString(),
			'Cache-Control': 'public, max-age=31536000, immutable',
			...MEDIA_HEADERS
		}
	});
};

export const HEAD: RequestHandler = async ({ params, request, platform }) => {
	const key = params.key;
	if (!key) {
		throw error(400, 'Missing object key');
	}

	const item = await getStoredItem(key, platform);

	if (!item) {
		return new Response(null, {
			status: 404,
			headers: {
				'Content-Type': 'text/plain',
				...MEDIA_HEADERS
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
				...MEDIA_HEADERS
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
				'Cache-Control': 'public, max-age=31536000, immutable',
				...MEDIA_HEADERS
			}
		});
	}

	return new Response(null, {
		status: 200,
		headers: {
			'Content-Type': item.contentType,
			'Accept-Ranges': 'bytes',
			'Content-Length': totalSize.toString(),
			'Cache-Control': 'public, max-age=31536000, immutable',
			...MEDIA_HEADERS
		}
	});
};

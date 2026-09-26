import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// In-memory buffer store for mock uploaded files during local dev / testing
const mockStorage = new Map<string, { buffer: ArrayBuffer; contentType: string }>();

export const PUT: RequestHandler = async ({ params, request }) => {
	const key = params.key;
	if (!key) {
		throw error(400, 'Missing object key');
	}

	const contentType = request.headers.get('content-type') || 'application/octet-stream';
	const arrayBuffer = await request.arrayBuffer();

	mockStorage.set(key, {
		buffer: arrayBuffer,
		contentType
	});

	return new Response(null, {
		status: 200,
		headers: {
			ETag: `"mock-${Date.now()}"`,
			'Access-Control-Allow-Origin': '*'
		}
	});
};

export const GET: RequestHandler = async ({ params }) => {
	const key = params.key;
	const item = key ? mockStorage.get(key) : undefined;

	if (!item) {
		// Return a fallback SVG placeholder if file is not found in memory
		const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#3a3b3c"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="16">Mock R2 Image</text></svg>`;
		return new Response(fallbackSvg, {
			headers: { 'Content-Type': 'image/svg+xml' }
		});
	}

	return new Response(item.buffer, {
		headers: {
			'Content-Type': item.contentType,
			'Cache-Control': 'public, max-age=3600'
		}
	});
};

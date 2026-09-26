import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generatePresignedUploadUrl } from '$lib/server/services/storage';

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	let body: { filename?: unknown; contentType?: unknown; size?: unknown };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON payload' }, { status: 400 });
	}

	const { filename, contentType, size } = body;

	if (!filename || typeof filename !== 'string') {
		return json({ error: 'Filename is required' }, { status: 400 });
	}

	if (!contentType || typeof contentType !== 'string') {
		return json({ error: 'Content-Type is required' }, { status: 400 });
	}

	if (size !== undefined && (typeof size !== 'number' || size < 0)) {
		return json({ error: 'Size must be a positive number' }, { status: 400 });
	}

	try {
		const result = await generatePresignedUploadUrl(platform?.env, {
			filename,
			contentType,
			size,
			userId: locals.user.id
		});

		return json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to generate upload URL';
		return json({ error: message }, { status: 400 });
	}
};

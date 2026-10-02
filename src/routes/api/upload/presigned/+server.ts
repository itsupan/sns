import { json } from '@sveltejs/kit';
import * as v from 'valibot';
import type { RequestHandler } from './$types';
import { UPLOAD_FOLDERS, generatePresignedUploadUrl } from '$lib/server/services/storage';
import { ApiError, enforceRateLimit, parseBody, requireUser, withApi } from '$lib/server/api';

const PresignRequest = v.object({
	filename: v.pipe(v.string('Filename is required'), v.minLength(1, 'Filename is required')),
	contentType: v.pipe(
		v.string('Content-Type is required'),
		v.minLength(1, 'Content-Type is required')
	),
	size: v.pipe(
		v.number('Size is required'),
		v.integer('Size must be a whole number of bytes'),
		v.minValue(1, 'Size must be a positive number')
	),
	folder: v.optional(v.picklist(UPLOAD_FOLDERS, 'Invalid upload folder'))
});

export const POST: RequestHandler = withApi(async ({ request, locals, platform }) => {
	const currentUser = requireUser(locals);
	await enforceRateLimit(platform, 'uploadPresign', currentUser.id);
	const { filename, contentType, size, folder } = await parseBody(request, PresignRequest);

	try {
		const result = await generatePresignedUploadUrl(platform?.env, {
			filename,
			contentType,
			size,
			userId: currentUser.id,
			prefix: folder
		});

		return json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to generate upload URL';
		throw new ApiError(400, 'upload_rejected', message);
	}
});

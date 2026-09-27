import { json } from '@sveltejs/kit';
import * as v from 'valibot';
import type { RequestHandler } from './$types';
import { generatePresignedUploadUrl } from '$lib/server/services/storage';
import { ApiError, parseBody, requireUser, withApi } from '$lib/server/api';

const PresignRequest = v.object({
	filename: v.pipe(v.string('Filename is required'), v.minLength(1, 'Filename is required')),
	contentType: v.pipe(
		v.string('Content-Type is required'),
		v.minLength(1, 'Content-Type is required')
	),
	size: v.optional(
		v.pipe(
			v.number('Size must be a positive number'),
			v.minValue(0, 'Size must be a positive number')
		)
	)
});

export const POST: RequestHandler = withApi(async ({ request, locals, platform }) => {
	const currentUser = requireUser(locals);
	const { filename, contentType, size } = await parseBody(request, PresignRequest);

	try {
		const result = await generatePresignedUploadUrl(platform?.env, {
			filename,
			contentType,
			size,
			userId: currentUser.id
		});

		return json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to generate upload URL';
		throw new ApiError(400, 'upload_rejected', message);
	}
});

import { json } from '@sveltejs/kit';
import { eq, and, ne } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import * as v from 'valibot';
import { user } from '$lib/server/db/schema';
import { approvalStatements, isFollowing } from '$lib/server/db/follows';
import { isOwnUpload } from '$lib/server/services/storage';
import {
	ApiError,
	apiError,
	enforceRateLimit,
	parseBody,
	requireUser,
	withApi
} from '$lib/server/api';

/** Optional nullable text field: `null` or `''` clears it, otherwise trimmed and length-checked. */
const clearableText = (
	label: string,
	max: number,
	maxMessage = `${label} cannot exceed ${max} characters`
) =>
	v.optional(
		v.pipe(
			v.nullable(v.string(`${label} must be a string or null`)),
			v.check((value) => value === null || value.length <= max, maxMessage),
			v.transform((value) => value?.trim() || null)
		)
	);

const UpdateProfile = v.object(
	{
		name: v.optional(
			v.pipe(
				v.string('Name must be a string'),
				v.trim(),
				v.minLength(1, 'Name cannot be empty'),
				v.maxLength(100, 'Name cannot exceed 100 characters')
			)
		),
		handle: v.optional(
			v.pipe(
				v.nullable(v.string('Handle must be a string or null')),
				v.transform((value) => value?.trim().replace(/^@/, '').toLowerCase() || null),
				v.check(
					(value) => value === null || /^[a-z0-9_.-]{1,30}$/.test(value),
					'Handle must be 1-30 characters and can only contain letters, numbers, dots, and underscores'
				)
			)
		),
		image: clearableText('Image', 2048, 'Image URL is too long'),
		bio: clearableText('Bio', 500),
		title: clearableText('Title', 100),
		website: v.optional(
			v.pipe(
				v.nullable(v.string('Website must be a string or null')),
				v.transform((value) => value?.trim().replace(/^https?:\/\//i, '') || null),
				v.check((value) => value === null || value.length <= 255, 'Website URL is too long')
			)
		),
		location: clearableText('Location', 100),
		cameraGear: clearableText('Camera gear', 200),
		isPrivate: v.optional(v.boolean('Private account must be true or false'))
	},
	'Request body must be an object'
);

export const GET: RequestHandler = withApi(async ({ params, locals }) => {
	const userId = params.id;
	if (!userId) {
		return apiError(400, 'bad_request', 'User ID is required');
	}

	const rows = await locals.db
		.select({
			id: user.id,
			name: user.name,
			image: user.image,
			handle: user.handle,
			bio: user.bio,
			title: user.title,
			website: user.website,
			location: user.location,
			cameraGear: user.cameraGear,
			followersCount: user.followersCount,
			followingCount: user.followingCount,
			createdAt: user.createdAt,
			updatedAt: user.updatedAt
		})
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);

	if (!rows || rows.length === 0) {
		return apiError(404, 'not_found', 'User not found');
	}

	// Whether the signed-in viewer follows this user; always false for anonymous viewers and yourself.
	const viewerId = locals.user?.id;
	const following =
		viewerId && viewerId !== userId ? await isFollowing(locals.db, viewerId, userId) : false;

	return json({ user: { ...rows[0], isFollowing: following } });
});

function handleTaken() {
	return new ApiError(409, 'handle_taken', 'This handle is already taken', {
		handle: 'This handle is already taken'
	});
}

export const PATCH: RequestHandler = withApi(async ({ params, request, locals, platform }) => {
	const targetUserId = params.id;
	if (!targetUserId) {
		return apiError(400, 'bad_request', 'User ID is required');
	}

	// 1. Authentication check
	const currentUser = requireUser(locals);

	// 2. Authorization check: User can only update their own profile
	if (currentUser.id !== targetUserId) {
		return apiError(403, 'forbidden', 'Forbidden: You cannot modify another user profile');
	}
	await enforceRateLimit(platform, 'profileUpdate', currentUser.id);

	// 3. Validate body; drop fields that were not sent
	const parsed = await parseBody(request, UpdateProfile);
	const updates = Object.fromEntries(
		Object.entries(parsed).filter(([, value]) => value !== undefined)
	) as Partial<typeof parsed>;

	if (Object.keys(updates).length === 0) {
		return apiError(400, 'validation_failed', 'No valid fields provided to update');
	}

	if (
		updates.image &&
		updates.image !== currentUser.image &&
		!isOwnUpload(updates.image, 'avatars', currentUser.id, platform?.env)
	) {
		const message = 'Upload the avatar first';
		throw new ApiError(400, 'validation_failed', message, { image: message });
	}

	if (updates.handle) {
		const existing = await locals.db
			.select({ id: user.id })
			.from(user)
			.where(and(eq(user.handle, updates.handle), ne(user.id, targetUserId)))
			.limit(1);

		if (existing.length > 0) throw handleTaken();
	}

	// 4. Update the user row in database
	const write = locals.db
		.update(user)
		.set({
			...updates,
			updatedAt: new Date()
		})
		.where(eq(user.id, targetUserId));
	try {
		// Anyone may follow a public account, so going public approves every pending request with it.
		if (updates.isPrivate === false) {
			await locals.db.batch([write, ...approvalStatements(locals.db, targetUserId)]);
		} else {
			await write;
		}
	} catch (err) {
		// The unique index is the real guard: two requests can both pass the check above.
		const detail = `${err} ${(err as { cause?: unknown })?.cause ?? ''}`;
		if (detail.includes('UNIQUE constraint failed: user.handle')) throw handleTaken();
		throw err;
	}

	// 5. Fetch updated row
	const updatedRows = await locals.db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			image: user.image,
			handle: user.handle,
			bio: user.bio,
			title: user.title,
			website: user.website,
			location: user.location,
			cameraGear: user.cameraGear,
			isPrivate: user.isPrivate,
			createdAt: user.createdAt,
			updatedAt: user.updatedAt
		})
		.from(user)
		.where(eq(user.id, targetUserId))
		.limit(1);

	return json({
		success: true,
		user: updatedRows[0]
	});
});

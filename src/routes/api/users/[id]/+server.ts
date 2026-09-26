import { json } from '@sveltejs/kit';
import { eq, and, ne } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { user } from '$lib/server/db/schema';

export const GET: RequestHandler = async ({ params, locals }) => {
	const userId = params.id;
	if (!userId) {
		return json({ error: 'User ID is required' }, { status: 400 });
	}

	const rows = await locals.db
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
			createdAt: user.createdAt,
			updatedAt: user.updatedAt
		})
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);

	if (!rows || rows.length === 0) {
		return json({ error: 'User not found' }, { status: 404 });
	}

	return json({ user: rows[0] });
};

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const targetUserId = params.id;
	if (!targetUserId) {
		return json({ error: 'User ID is required' }, { status: 400 });
	}

	// 1. Authentication check
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	// 2. Authorization check: User can only update their own profile
	if (locals.user.id !== targetUserId) {
		return json({ error: 'Forbidden: You cannot modify another user profile' }, { status: 403 });
	}

	// 3. Parse JSON body
	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON payload' }, { status: 400 });
	}

	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		return json({ error: 'Request body must be an object' }, { status: 400 });
	}

	const updates: {
		name?: string;
		handle?: string | null;
		image?: string | null;
		bio?: string | null;
		title?: string | null;
		website?: string | null;
		location?: string | null;
		cameraGear?: string | null;
	} = {};

	// Validate 'name'
	if ('name' in body) {
		if (typeof body.name !== 'string') {
			return json({ error: 'Name must be a string', field: 'name' }, { status: 400 });
		}
		const trimmedName = body.name.trim();
		if (trimmedName.length < 1) {
			return json({ error: 'Name cannot be empty', field: 'name' }, { status: 400 });
		}
		if (trimmedName.length > 100) {
			return json({ error: 'Name cannot exceed 100 characters', field: 'name' }, { status: 400 });
		}
		updates.name = trimmedName;
	}

	// Validate 'handle'
	if ('handle' in body) {
		if (body.handle === null || body.handle === '') {
			updates.handle = null;
		} else if (typeof body.handle === 'string') {
			const sanitizedHandle = body.handle.trim().replace(/^@/, '').toLowerCase();
			if (!/^[a-z0-9_.-]{1,30}$/.test(sanitizedHandle)) {
				return json(
					{
						error:
							'Handle must be 1-30 characters and can only contain letters, numbers, dots, and underscores',
						field: 'handle'
					},
					{ status: 400 }
				);
			}

			// Check handle uniqueness
			const existing = await locals.db
				.select({ id: user.id })
				.from(user)
				.where(and(eq(user.handle, sanitizedHandle), ne(user.id, targetUserId)))
				.limit(1);

			if (existing.length > 0) {
				return json({ error: 'This handle is already taken', field: 'handle' }, { status: 409 });
			}

			updates.handle = sanitizedHandle;
		} else {
			return json({ error: 'Handle must be a string or null', field: 'handle' }, { status: 400 });
		}
	}

	// Validate 'image'
	if ('image' in body) {
		if (body.image === null || body.image === '') {
			updates.image = null;
		} else if (typeof body.image === 'string') {
			if (body.image.length > 2048) {
				return json({ error: 'Image URL is too long', field: 'image' }, { status: 400 });
			}
			updates.image = body.image.trim();
		} else {
			return json({ error: 'Image must be a URL string or null', field: 'image' }, { status: 400 });
		}
	}

	// Validate 'bio'
	if ('bio' in body) {
		if (body.bio === null || body.bio === '') {
			updates.bio = null;
		} else if (typeof body.bio === 'string') {
			if (body.bio.length > 500) {
				return json({ error: 'Bio cannot exceed 500 characters', field: 'bio' }, { status: 400 });
			}
			updates.bio = body.bio.trim();
		} else {
			return json({ error: 'Bio must be a string or null', field: 'bio' }, { status: 400 });
		}
	}

	// Validate 'title'
	if ('title' in body) {
		if (body.title === null || body.title === '') {
			updates.title = null;
		} else if (typeof body.title === 'string') {
			if (body.title.length > 100) {
				return json(
					{ error: 'Title cannot exceed 100 characters', field: 'title' },
					{ status: 400 }
				);
			}
			updates.title = body.title.trim();
		} else {
			return json({ error: 'Title must be a string or null', field: 'title' }, { status: 400 });
		}
	}

	// Validate 'website'
	if ('website' in body) {
		if (body.website === null || body.website === '') {
			updates.website = null;
		} else if (typeof body.website === 'string') {
			const cleanWebsite = body.website.trim().replace(/^https?:\/\//i, '');
			if (cleanWebsite.length > 255) {
				return json({ error: 'Website URL is too long', field: 'website' }, { status: 400 });
			}
			updates.website = cleanWebsite;
		} else {
			return json({ error: 'Website must be a string or null', field: 'website' }, { status: 400 });
		}
	}

	// Validate 'location'
	if ('location' in body) {
		if (body.location === null || body.location === '') {
			updates.location = null;
		} else if (typeof body.location === 'string') {
			if (body.location.length > 100) {
				return json(
					{ error: 'Location cannot exceed 100 characters', field: 'location' },
					{ status: 400 }
				);
			}
			updates.location = body.location.trim();
		} else {
			return json(
				{ error: 'Location must be a string or null', field: 'location' },
				{ status: 400 }
			);
		}
	}

	// Validate 'cameraGear'
	if ('cameraGear' in body) {
		if (body.cameraGear === null || body.cameraGear === '') {
			updates.cameraGear = null;
		} else if (typeof body.cameraGear === 'string') {
			if (body.cameraGear.length > 200) {
				return json(
					{ error: 'Camera gear cannot exceed 200 characters', field: 'cameraGear' },
					{ status: 400 }
				);
			}
			updates.cameraGear = body.cameraGear.trim();
		} else {
			return json(
				{ error: 'Camera gear must be a string or null', field: 'cameraGear' },
				{ status: 400 }
			);
		}
	}

	if (Object.keys(updates).length === 0) {
		return json({ error: 'No valid fields provided to update' }, { status: 400 });
	}

	// 4. Update the user row in database
	await locals.db
		.update(user)
		.set({
			...updates,
			updatedAt: new Date()
		})
		.where(eq(user.id, targetUserId));

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
};

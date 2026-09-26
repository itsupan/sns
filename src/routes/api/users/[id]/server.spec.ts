import { describe, expect, it, vi } from 'vitest';
import { GET, PATCH } from './+server';
import type { RequestEvent } from './$types';

function createMockDb(initialUsers: Array<Record<string, unknown>> = []) {
	const users = [...initialUsers];

	const db = {
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				where: vi.fn(() => ({
					limit: vi.fn(async () => {
						// Simple filter simulation
						return users;
					})
				}))
			}))
		})),
		update: vi.fn(() => ({
			set: vi.fn((updates: Record<string, unknown>) => ({
				where: vi.fn(async () => {
					if (users.length > 0) {
						Object.assign(users[0], updates);
					}
					return [{ success: true }];
				})
			}))
		}))
	};

	return { db, users };
}

describe('GET /api/users/:id', () => {
	it('returns 404 when user is not found', async () => {
		const { db } = createMockDb([]);
		// Override select to return empty
		db.select = vi.fn(() => ({
			from: vi.fn(() => ({
				where: vi.fn(() => ({
					limit: vi.fn(async () => [])
				}))
			}))
		}));

		const event = {
			params: { id: 'non-existent' },
			locals: { db }
		} as unknown as RequestEvent;

		const res = await GET(event);
		expect(res.status).toBe(404);
		const body = await res.json();
		expect(body).toEqual({ error: 'User not found' });
	});

	it('returns user profile when user exists', async () => {
		const mockUser = {
			id: 'user-1',
			name: 'Elena Rostova',
			email: 'elena@example.com',
			handle: 'elena.rostova',
			bio: 'Photographer',
			image: 'https://example.com/avatar.jpg'
		};

		const { db } = createMockDb([mockUser]);
		db.select = vi.fn(() => ({
			from: vi.fn(() => ({
				where: vi.fn(() => ({
					limit: vi.fn(async () => [mockUser])
				}))
			}))
		}));

		const event = {
			params: { id: 'user-1' },
			locals: { db }
		} as unknown as RequestEvent;

		const res = await GET(event);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { user?: unknown };
		expect(body.user).toEqual(mockUser);
	});
});

describe('PATCH /api/users/:id', () => {
	it('returns 401 when user is not logged in', async () => {
		const event = {
			params: { id: 'user-1' },
			request: new Request('http://localhost/api/users/user-1', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: 'New Name' })
			}),
			locals: { user: null }
		} as unknown as RequestEvent;

		const res = await PATCH(event);
		expect(res.status).toBe(401);
		const body = (await res.json()) as { error?: string };
		expect(body).toEqual({ error: 'Unauthorized' });
	});

	it('returns 403 when user attempts to update someone else profile', async () => {
		const event = {
			params: { id: 'user-2' },
			request: new Request('http://localhost/api/users/user-2', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: 'Hacked Name' })
			}),
			locals: { user: { id: 'user-1' } }
		} as unknown as RequestEvent;

		const res = await PATCH(event);
		expect(res.status).toBe(403);
		const body = (await res.json()) as { error?: string };
		expect(body.error).toContain('Forbidden');
	});

	it('returns 400 when name is empty', async () => {
		const event = {
			params: { id: 'user-1' },
			request: new Request('http://localhost/api/users/user-1', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: '   ' })
			}),
			locals: { user: { id: 'user-1' } }
		} as unknown as RequestEvent;

		const res = await PATCH(event);
		expect(res.status).toBe(400);
		const body = (await res.json()) as { error?: string };
		expect(body.error).toBe('Name cannot be empty');
	});

	it('returns 400 when handle contains invalid characters', async () => {
		const event = {
			params: { id: 'user-1' },
			request: new Request('http://localhost/api/users/user-1', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ handle: 'bad handle!' })
			}),
			locals: { user: { id: 'user-1' } }
		} as unknown as RequestEvent;

		const res = await PATCH(event);
		expect(res.status).toBe(400);
		const body = (await res.json()) as { error?: string };
		expect(body.error).toContain('Handle must be 1-30 characters');
	});

	it('returns 409 when handle is already taken by another user', async () => {
		const { db } = createMockDb();
		// Mock select query to return an existing user with that handle
		db.select = vi.fn(() => ({
			from: vi.fn(() => ({
				where: vi.fn(() => ({
					limit: vi.fn(async () => [{ id: 'other-user' }])
				}))
			}))
		}));

		const event = {
			params: { id: 'user-1' },
			request: new Request('http://localhost/api/users/user-1', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ handle: 'taken_handle' })
			}),
			locals: { user: { id: 'user-1' }, db }
		} as unknown as RequestEvent;

		const res = await PATCH(event);
		expect(res.status).toBe(409);
		const body = (await res.json()) as { error?: string };
		expect(body.error).toBe('This handle is already taken');
	});

	it('successfully updates user profile data', async () => {
		const existingUser = {
			id: 'user-1',
			name: 'Old Name',
			email: 'user@example.com',
			handle: 'old.handle',
			bio: 'Old Bio',
			image: null,
			title: null,
			website: null,
			location: null,
			cameraGear: null
		};

		const { db } = createMockDb([existingUser]);

		let selectCount = 0;
		db.select = vi.fn(() => ({
			from: vi.fn(() => ({
				where: vi.fn(() => ({
					limit: vi.fn(async () => {
						selectCount++;
						if (selectCount === 1) {
							// Handle uniqueness check: no conflict
							return [];
						}
						// Return updated user
						return [
							{
								...existingUser,
								name: 'Elena Rostova',
								handle: 'elena.rostova',
								title: 'Architectural Photographer',
								bio: 'Capturing brutalist geometries',
								image: 'https://cdn.example.com/avatar.jpg'
							}
						];
					})
				}))
			}))
		}));

		const event = {
			params: { id: 'user-1' },
			request: new Request('http://localhost/api/users/user-1', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: 'Elena Rostova',
					handle: '@elena.rostova',
					title: 'Architectural Photographer',
					bio: 'Capturing brutalist geometries',
					image: 'https://cdn.example.com/avatar.jpg'
				})
			}),
			locals: { user: { id: 'user-1' }, db }
		} as unknown as RequestEvent;

		const res = await PATCH(event);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { success: boolean; user: Record<string, unknown> };
		expect(body.success).toBe(true);
		expect(body.user.name).toBe('Elena Rostova');
		expect(body.user.handle).toBe('elena.rostova');
		expect(body.user.image).toBe('https://cdn.example.com/avatar.jpg');
	});
});

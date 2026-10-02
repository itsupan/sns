import { describe, expect, it, vi } from 'vitest';
import { load } from './+page.server';

type LoadEvent = Parameters<typeof load>[0];

describe('Public Profile +page.server.ts', () => {
	it('loads user profile data for unauthenticated visitors', async () => {
		const mockTargetUser = {
			id: 'user-public-1',
			name: 'Aoi Tanaka',
			email: 'aoi@example.com',
			image: 'https://example.com/aoi.jpg',
			handle: 'aoi.photo',
			title: 'Editorial Photographer',
			bio: 'Shibuya night walks.',
			website: 'aoitanaka.com',
			location: 'Tokyo',
			cameraGear: 'Sony A7IV'
		};

		const mockDb = {
			select: vi.fn(() => ({
				from: vi.fn(() => ({
					where: vi.fn(() => ({
						limit: vi.fn(async () => [mockTargetUser])
					}))
				}))
			}))
		};

		const mockEvent = {
			params: { id: 'aoi.photo' },
			url: new URL('http://localhost:5173/profile/aoi.photo'),
			locals: {
				user: null, // Unauthenticated visitor!
				db: mockDb
			}
		} as unknown as LoadEvent;

		const result = await load(mockEvent);
		expect(result).toBeDefined();
		if (!result) throw new Error('Expected result');
		expect(result.targetUser.name).toBe('Aoi Tanaka');
		expect(result.targetUser.handle).toBe('aoi.photo');
		expect(result.targetUser).not.toHaveProperty('email');
		expect(result.isOwnProfile).toBe(false);
		expect(result.canonicalUrl).toBe('http://localhost:5173/profile/@aoi.photo');
	});

	it('detects isOwnProfile = true when the logged in user visits their own public profile link', async () => {
		const mockTargetUser = {
			id: 'user-auth-1',
			name: 'Taro Yamada',
			email: 'taro@example.com',
			handle: 'taroy'
		};

		const mockDb = {
			select: vi.fn(() => ({
				from: vi.fn(() => ({
					where: vi.fn(() => ({
						limit: vi.fn(async () => [mockTargetUser])
					}))
				}))
			}))
		};

		const mockEvent = {
			params: { id: 'taroy' },
			url: new URL('http://localhost:5173/profile/taroy'),
			locals: {
				user: { id: 'user-auth-1', name: 'Taro Yamada' },
				db: mockDb
			}
		} as unknown as LoadEvent;

		const result = await load(mockEvent);
		expect(result).toBeDefined();
		if (!result) throw new Error('Expected result');
		expect(result.isOwnProfile).toBe(true);
		expect(result.canonicalUrl).toBe('http://localhost:5173/profile/@taroy');
	});

	it('throws 404 when user cannot be found in database', async () => {
		const mockDb = {
			select: vi.fn(() => ({
				from: vi.fn(() => ({
					where: vi.fn(() => ({
						limit: vi.fn(async () => [])
					}))
				}))
			}))
		};

		const mockEvent = {
			params: { id: 'nonexistent-user' },
			url: new URL('http://localhost:5173/profile/nonexistent-user'),
			locals: {
				user: null,
				db: mockDb
			}
		} as unknown as LoadEvent;

		try {
			await load(mockEvent);
			expect.fail('Should have thrown 404');
		} catch (err: unknown) {
			const errorObj = err as { status?: number; body?: { message?: string } };
			expect(errorObj.status).toBe(404);
		}
	});
});

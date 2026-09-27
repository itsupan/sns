import { describe, expect, it, vi } from 'vitest';
import { load } from './+page.server';

// Media now comes from post_media via loadPostMedia; stub it with fixture rows.
vi.mock('$lib/server/db/posts', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/db/posts')>();
	const media: Record<string, Array<{ url: string; type: 'image' | 'video' }>> = {
		'p-1': [
			{ url: 'https://example.com/bowl.jpg', type: 'image' },
			{ url: 'https://example.com/bowl2.jpg', type: 'image' }
		]
	};
	return {
		...actual,
		loadPostMedia: vi.fn(
			async (_db: unknown, ids: string[]) =>
				new Map(ids.filter((id) => media[id]).map((id) => [id, media[id]]))
		)
	};
});

type LoadEvent = Parameters<typeof load>[0];

describe('Profile +page.server.ts', () => {
	it('redirects to /login when user is not authenticated', async () => {
		const mockEvent = {
			locals: { user: null },
			url: new URL('http://localhost:5173/profile')
		} as unknown as LoadEvent;

		try {
			await load(mockEvent);
			expect.fail('Should have thrown redirect');
		} catch (err: unknown) {
			const redirectErr = err as { status?: number; location?: string };
			expect(redirectErr.status).toBe(302);
			expect(redirectErr.location).toContain('/login?redirectTo=%2Fprofile');
		}
	});

	it('returns user profile data when user is authenticated', async () => {
		const mockUser = {
			id: 'user-auth-1',
			name: 'Taro Yamada',
			email: 'taro@example.com',
			image: 'https://example.com/avatar.jpg',
			handle: 'taroy',
			title: 'Visual Storyteller',
			bio: 'Capturing moments.',
			website: 'taroyamada.com',
			location: 'Osaka, Japan',
			cameraGear: 'Fujifilm X-T5'
		};

		const mockDb = {
			select: vi.fn(() => ({
				from: vi.fn(() => ({
					where: vi.fn(() => ({
						limit: vi.fn(async () => [mockUser])
					}))
				}))
			}))
		};

		const mockEvent = {
			locals: {
				user: { id: 'user-auth-1', name: 'Taro Yamada', email: 'taro@example.com' },
				db: mockDb
			},
			url: new URL('http://localhost:5173/profile')
		} as unknown as LoadEvent;

		const result = await load(mockEvent);
		expect(result).toBeDefined();
		if (!result) throw new Error('Expected result from load');
		expect(result.user.name).toBe('Taro Yamada');
		expect(result.user.handle).toBe('taroy');
		expect(result.user.bio).toBe('Capturing moments.');
	});

	it('returns user posts list from database', async () => {
		const mockUser = {
			id: 'user-auth-1',
			name: 'Taro Yamada',
			email: 'taro@example.com'
		};

		const mockPost = {
			id: 'p-1',
			userId: 'user-auth-1',
			title: 'Tea Bowl',
			content: 'A study on clay',
			mediaUrl: 'https://example.com/bowl.jpg',
			mediaType: 'image',
			mediaUrls: JSON.stringify([
				{ url: 'https://example.com/bowl.jpg', type: 'image' },
				{ url: 'https://example.com/bowl2.jpg', type: 'image' }
			]),
			likesCount: 15,
			commentsCount: 3,
			createdAt: new Date()
		};

		let callCount = 0;
		const mockDb = {
			select: vi.fn(() => ({
				from: vi.fn(() => ({
					where: vi.fn(() => {
						callCount++;
						if (callCount === 1) {
							return { limit: vi.fn(async () => [mockUser]) };
						}
						return {
							orderBy: vi.fn(async () => [mockPost])
						};
					})
				}))
			}))
		};

		const mockEvent = {
			locals: {
				user: { id: 'user-auth-1', name: 'Taro Yamada', email: 'taro@example.com' },
				db: mockDb
			},
			url: new URL('http://localhost:5173/profile')
		} as unknown as LoadEvent;

		const result = await load(mockEvent);
		expect(result).toBeDefined();
		if (!result) throw new Error('Expected result from load');
		expect(result.posts).toHaveLength(1);
		expect(result.posts[0].id).toBe('p-1');
		expect(result.posts[0].isCarousel).toBe(true);
		expect(result.posts[0].likes).toBe(15);
	});
});

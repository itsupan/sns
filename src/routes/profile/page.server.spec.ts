import { describe, expect, it, vi } from 'vitest';
import type { PostData } from '$lib/components/feed/PostCard.svelte';
import { loadProfilePosts } from '$lib/server/db/profiles';
import { load } from './+page.server';

// Posts, stats and saves have their own real-D1 specs; this one covers what the page does with them.
vi.mock('$lib/server/db/profiles', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/db/profiles')>();
	return { ...actual, loadProfilePosts: vi.fn(async () => ({ posts: [], nextCursor: null })) };
});
vi.mock('$lib/server/db/saves', () => ({ loadSavedPreview: vi.fn(async () => []) }));

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

	it('returns the first page of posts as grid items, with the cursor for the next', async () => {
		const mockUser = {
			id: 'user-auth-1',
			name: 'Taro Yamada',
			email: 'taro@example.com'
		};
		const card = {
			id: 'p-1',
			author: { id: 'user-auth-1', name: 'Taro Yamada', handle: '@taroyamada', avatar: '' },
			title: 'Tea Bowl',
			description: 'A study on clay',
			image: 'https://example.com/bowl.jpg',
			mediaItems: [
				{ url: 'https://example.com/bowl.jpg', type: 'image' },
				{ url: 'https://example.com/bowl2.jpg', type: 'image' }
			],
			likes: 15,
			commentsCount: 3
		} as PostData;
		vi.mocked(loadProfilePosts).mockResolvedValueOnce({ posts: [card], nextCursor: '1700_p-1' });

		// user lookup → .limit(); stats → awaited directly.
		const mockDb = {
			select: vi.fn(() => ({
				from: vi.fn(() => ({
					where: vi.fn(() =>
						Object.assign(Promise.resolve([{ postsCount: 1, impressionsCount: 7 }]), {
							limit: vi.fn(async () => [mockUser])
						})
					)
				}))
			}))
		};

		const mockEvent = {
			locals: {
				user: { id: 'user-auth-1', name: 'Taro Yamada', email: 'taro@example.com' },
				db: mockDb
			},
			url: new URL('http://localhost:5173/profile'),
			platform: { env: { PROFILE_PAGE_SIZE: '9' } }
		} as unknown as LoadEvent;

		const result = await load(mockEvent);
		expect(result).toBeDefined();
		if (!result) throw new Error('Expected result from load');
		expect(loadProfilePosts).toHaveBeenCalledWith(mockDb, 'user-auth-1', 'user-auth-1', {
			limit: 9
		});
		expect(result.posts).toHaveLength(1);
		expect(result.posts[0]).toMatchObject({ id: 'p-1', isCarousel: true, likes: 15 });
		// Full post for list view, same shape the feed uses.
		expect(result.posts[0].post?.description).toBe('A study on clay');
		expect(result.nextCursor).toBe('1700_p-1');
		expect(result.stats.postsCount).toBe(1);
		expect(result.stats.impressionsCount).toBe(7);
	});
});

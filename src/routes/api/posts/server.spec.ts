import type { ApiErrorBody } from '$lib/server/api';
import { describe, expect, it, vi } from 'vitest';
import { GET, POST } from './+server';
import type { RequestEvent } from './$types';

// Media now comes from post_media via loadPostMedia; stub it with fixture rows.
vi.mock('$lib/server/db/posts', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/db/posts')>();
	const media: Record<string, Array<{ url: string; type: 'image' | 'video' }>> = {
		'post-1': [{ url: 'https://example.com/photo.jpg', type: 'image' }]
	};
	return {
		...actual,
		loadPostMedia: vi.fn(
			async (_db: unknown, ids: string[]) =>
				new Map(ids.filter((id) => media[id]).map((id) => [id, media[id]]))
		)
	};
});

describe('GET /api/posts', () => {
	it('returns a list of posts from database', async () => {
		const mockPosts = [
			{
				post: {
					id: 'post-1',
					userId: 'user-1',
					title: 'Brutalist Concrete',
					content: 'A study on dawn light.',
					cameraMeta: '35mm',
					tags: JSON.stringify(['#MinimalArchitecture']),
					likesCount: 10,
					commentsCount: 2,
					sharesCount: 1,
					createdAt: new Date()
				},
				user: {
					id: 'user-1',
					name: 'Elena Rostova',
					handle: 'elena.rostova',
					image: 'https://example.com/avatar.jpg',
					location: 'Copenhagen, Denmark'
				}
			}
		];

		const db = {
			select: vi.fn(() => ({
				from: vi.fn(() => ({
					innerJoin: vi.fn(() => ({
						// Feed query: .where(notDeleted).orderBy().limit().offset();
						// comment previews: .where().orderBy() awaited directly.
						where: vi.fn(() => ({
							orderBy: vi.fn(() =>
								Object.assign(Promise.resolve([]), {
									limit: vi.fn(() => ({
										offset: vi.fn(async () => mockPosts)
									}))
								})
							)
						}))
					})),
					where: vi.fn(async () => [])
				}))
			}))
		};

		const url = new URL('http://localhost/api/posts?limit=10&offset=0');
		const event = {
			url,
			locals: { db, user: null }
		} as unknown as RequestEvent;

		const res = await GET(event);
		expect(res.status).toBe(200);

		const data = (await res.json()) as {
			posts: Array<{
				id: string;
				author: { name: string; handle: string };
				tags: string[];
			}>;
		};
		expect(data.posts).toHaveLength(1);
		expect(data.posts[0].id).toBe('post-1');
		expect(data.posts[0].author.name).toBe('Elena Rostova');
		expect(data.posts[0].author.handle).toBe('@elena.rostova');
		expect(data.posts[0].tags).toEqual(['#MinimalArchitecture']);
	});

	it('returns empty array when no posts exist', async () => {
		const db = {
			select: vi.fn(() => ({
				from: vi.fn(() => ({
					innerJoin: vi.fn(() => ({
						where: vi.fn(() => ({
							orderBy: vi.fn(() => ({
								limit: vi.fn(() => ({
									offset: vi.fn(async () => [])
								}))
							}))
						}))
					}))
				}))
			}))
		};

		const url = new URL('http://localhost/api/posts');
		const event = {
			url,
			locals: { db, user: null }
		} as unknown as RequestEvent;

		const res = await GET(event);
		expect(res.status).toBe(200);

		const data = (await res.json()) as { posts: unknown[] };
		expect(data.posts).toEqual([]);
	});
});

describe('POST /api/posts', () => {
	it('returns 401 when user is not authenticated', async () => {
		const event = {
			request: {
				json: async () => ({ content: 'Hello world' })
			},
			locals: { user: null }
		} as unknown as RequestEvent;

		const res = await POST(event);
		expect(res.status).toBe(401);
		const data = (await res.json()) as ApiErrorBody;
		expect(data.error.code).toBe('unauthorized');
	});

	it('returns 400 when content is empty', async () => {
		const event = {
			request: {
				json: async () => ({ content: '   ' })
			},
			locals: { user: { id: 'u-1', name: 'Kai' } }
		} as unknown as RequestEvent;

		const res = await POST(event);
		expect(res.status).toBe(400);
		const data = (await res.json()) as ApiErrorBody;
		expect(data.error.message).toBe('Post content is required');
	});

	it('creates a new post with text and media successfully', async () => {
		let insertedRow: Record<string, unknown> | null = null;
		const db = {
			insert: vi.fn(() => ({
				values: vi.fn(async (val: Record<string, unknown>) => {
					// First insert is the post row; later ones are post_media rows.
					insertedRow ??= val;
					return [{ success: true }];
				})
			})),
			batch: vi.fn(async (queries: unknown[]) => Promise.all(queries))
		};

		const event = {
			request: {
				json: async () => ({
					content: 'New ceramic bowl finished.',
					title: 'Ceramics',
					mediaUrl: 'https://example.com/bowl.mp4',
					mediaType: 'video',
					postType: 'photo',
					tags: ['ceramics', 'pottery']
				})
			},
			locals: {
				db,
				user: {
					id: 'u-1',
					name: 'Kai Takahashi',
					handle: 'kai.raw',
					image: 'https://example.com/kai.jpg'
				}
			}
		} as unknown as RequestEvent;

		const res = await POST(event);
		expect(res.status).toBe(201);

		const data = (await res.json()) as {
			post: {
				description: string;
				mediaType: string;
				tags: string[];
			};
		};
		expect(data.post).toBeDefined();
		expect(data.post.description).toBe('New ceramic bowl finished.');
		expect(data.post.mediaType).toBe('video');
		expect(data.post.tags).toEqual(['#ceramics', '#pottery']);
		expect(insertedRow).not.toBeNull();
	});

	it('creates a post with multiple media plates, aspect ratio, and location', async () => {
		let insertedRow: Record<string, unknown> | null = null;
		const db = {
			insert: vi.fn(() => ({
				values: vi.fn(async (val: Record<string, unknown>) => {
					// First insert is the post row; later ones are post_media rows.
					insertedRow ??= val;
					return [{ success: true }];
				})
			})),
			batch: vi.fn(async (queries: unknown[]) => Promise.all(queries))
		};

		const event = {
			request: {
				json: async () => ({
					content: 'Exhibition studies at Neue Biennale.',
					title: 'Monoliths of Silence',
					mediaUrls: [
						{ url: 'https://example.com/plate1.jpg', type: 'image' },
						{ url: 'https://example.com/plate2.jpg', type: 'image' }
					],
					aspectRatio: '4:5',
					location: 'Fondazione Prada, Milano',
					postType: 'photo',
					tags: ['curated', 'architecture']
				})
			},
			locals: {
				db,
				user: {
					id: 'u-elena',
					name: 'Elena Rostova',
					handle: 'elena.rostova',
					image: 'https://example.com/elena.jpg'
				}
			}
		} as unknown as RequestEvent;

		const res = await POST(event);
		expect(res.status).toBe(201);

		const data = (await res.json()) as {
			post: {
				description: string;
				mediaItems: Array<{ url: string; type: string }>;
				aspectRatio: string;
				location: string;
			};
		};
		expect(data.post.mediaItems).toHaveLength(2);
		expect(data.post.aspectRatio).toBe('4:5');
		expect(data.post.location).toBe('Fondazione Prada, Milano');
		expect(insertedRow).toMatchObject({
			aspectRatio: '4:5',
			location: 'Fondazione Prada, Milano'
		});
	});
});

import type { ApiErrorBody } from '$lib/server/api';
import { describe, expect, it, vi } from 'vitest';
import { GET, POST } from './+server';
import type { RequestEvent } from './$types';

// Media and tags come from post_media / post_tag via loaders; stub them with fixture rows.
// attachTagsStatements and the mocked media insert record what the handler would store so
// loadPostTags and loadPostMedia can echo it.
const media = vi.hoisted<Record<string, Array<{ url: string; type: 'image' | 'video' }>>>(() => ({
	'post-1': [{ url: 'https://example.com/photo.jpg', type: 'image' }]
}));
vi.mock('$lib/server/db/polls', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/server/db/polls')>()),
	loadPolls: vi.fn(async () => new Map())
}));
vi.mock('$lib/server/db/posts', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/db/posts')>();
	const tags: Record<string, string[]> = { 'post-1': ['#MinimalArchitecture'] };
	return {
		...actual,
		loadRecentLikers: vi.fn(async () => new Map()),
		loadCommentPreviews: vi.fn(async () => new Map()),
		loadPostMedia: vi.fn(
			async (_db: unknown, ids: string[]) =>
				new Map(ids.filter((id) => media[id]).map((id) => [id, media[id]]))
		),
		loadPostTags: vi.fn(
			async (_db: unknown, ids: string[]) =>
				new Map(ids.filter((id) => tags[id]).map((id) => [id, tags[id]]))
		),
		attachTagsStatements: vi.fn(
			(_db: unknown, postId: string, normalized: Array<{ name: string }>) => {
				tags[postId] = normalized.map((t) => `#${t.name}`);
				return [];
			}
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
						// Feed query: .where(notDeleted).orderBy().limit().
						where: vi.fn(() => ({
							orderBy: vi.fn(() => ({ limit: vi.fn(async () => mockPosts) }))
						}))
					})),
					where: vi.fn(async () => [])
				}))
			}))
		};

		const url = new URL('http://localhost/api/posts?limit=10');
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
								limit: vi.fn(async () => [])
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

/**
 * A drizzle-shaped mock for creating a post: records the inserted post and media rows, reads the
 * post back joined with `author`, and resolves the viewer's likes and saves empty.
 */
function createDb(author: Record<string, unknown>) {
	let insertedRow: Record<string, unknown> | null = null;
	const readBack: Record<string, unknown> = {
		from: () => readBack,
		innerJoin: () => readBack,
		where: () => readBack,
		limit: async () => [
			{ post: { ...insertedRow, createdAt: new Date() }, user: { location: null, ...author } }
		],
		then: (resolve: (value: unknown[]) => void) => resolve([])
	};
	const db = {
		insert: vi.fn(() => ({
			values: vi.fn(async (val: Record<string, unknown> | Array<Record<string, unknown>>) => {
				if (Array.isArray(val)) {
					media[val[0].postId as string] = val.map((m) => ({
						url: m.url as string,
						type: m.type as 'image' | 'video'
					}));
				} else {
					insertedRow ??= val;
				}
				return [{ success: true }];
			})
		})),
		select: vi.fn(() => readBack),
		batch: vi.fn(async (queries: unknown[]) => Promise.all(queries))
	};
	return { db, insertedRow: () => insertedRow };
}

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

	it.each([
		['content', { content: 'x'.repeat(5001) }, 'Post content is too long'],
		['title', { content: 'ok', title: 'x'.repeat(201) }, 'Title is too long'],
		['location', { content: 'ok', location: 'x'.repeat(101) }, 'Location is too long'],
		['cameraMeta', { content: 'ok', cameraMeta: 'x'.repeat(101) }, 'Camera details are too long']
	])('returns 400 when %s is over its length limit', async (field, body, message) => {
		const event = {
			request: { json: async () => body },
			locals: { user: { id: 'u-1', name: 'Kai' } }
		} as unknown as RequestEvent;

		const res = await POST(event);
		expect(res.status).toBe(400);
		const data = (await res.json()) as ApiErrorBody;
		expect(data.error.fields).toEqual({ [field]: message });
	});

	it('creates a new post with text and media successfully', async () => {
		const user = {
			id: 'u-1',
			name: 'Kai Takahashi',
			handle: 'kai.raw',
			image: 'https://example.com/kai.jpg'
		};
		const { db, insertedRow } = createDb(user);

		const event = {
			request: {
				json: async () => ({
					content: 'New ceramic bowl finished.',
					title: 'Ceramics',
					mediaUrl: '/api/media/posts/u-1/bowl.mp4',
					mediaType: 'video',
					postType: 'photo',
					tags: ['ceramics', 'pottery']
				})
			},
			locals: { db, user }
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
		expect(insertedRow()).not.toBeNull();
	});

	it('creates a post with multiple media plates, aspect ratio, and location', async () => {
		const user = {
			id: 'u-elena',
			name: 'Elena Rostova',
			handle: 'elena.rostova',
			image: 'https://example.com/elena.jpg'
		};
		const { db, insertedRow } = createDb(user);

		const event = {
			request: {
				json: async () => ({
					content: 'Exhibition studies at Neue Biennale.',
					title: 'Monoliths of Silence',
					mediaUrls: [
						{ url: '/api/media/posts/u-elena/plate1.jpg', type: 'image' },
						{ url: '/api/media/posts/u-elena/plate2.jpg', type: 'image' }
					],
					aspectRatio: '4:5',
					location: 'Fondazione Prada, Milano',
					postType: 'photo',
					tags: ['curated', 'architecture']
				})
			},
			locals: { db, user }
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
		expect(insertedRow()).toMatchObject({
			aspectRatio: '4:5',
			location: 'Fondazione Prada, Milano'
		});
	});
});

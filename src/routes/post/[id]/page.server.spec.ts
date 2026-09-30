import { describe, expect, it, vi } from 'vitest';
import { load } from './+page.server';

// Media and tags come from post_media / post_tag via loaders; stub them.
vi.mock('$lib/server/db/posts', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/db/posts')>();
	const media: Record<string, Array<{ url: string; type: 'image' | 'video' }>> = {
		'post-100': [{ url: 'https://example.com/photo.jpg', type: 'image' }],
		'post-1': [{ url: 'https://example.com/photo.jpg', type: 'image' }]
	};
	return {
		...actual,
		loadPostMedia: vi.fn(
			async (_db: unknown, ids: string[]) =>
				new Map(ids.filter((id) => media[id]).map((id) => [id, media[id]]))
		),
		loadPostTags: vi.fn(async () => new Map<string, string[]>())
	};
});

type LoadEvent = Parameters<typeof load>[0];

/**
 * A drizzle-shaped mock: `.limit()` resolves to `rows` (the post query), queries awaited right
 * after `.where()` (the viewer's likes and saves) and comment previews resolve empty, and
 * `update(...)` (the view counter) is recorded.
 */
function postDb(rows: unknown[]) {
	const viewCount = vi.fn(async () => undefined);
	const query: Record<string, unknown> = {};
	Object.assign(query, {
		from: () => query,
		innerJoin: () => query,
		where: () => query,
		limit: async () => rows,
		orderBy: () => ({ limit: async () => [] }),
		then: (resolve: (value: unknown[]) => void) => resolve([])
	});
	const db = {
		select: vi.fn(() => query),
		update: vi.fn(() => ({ set: () => ({ where: viewCount }) }))
	};
	return { db, viewCount };
}

describe('Individual Post +page.server.ts', () => {
	it('loads post from database with author info and media', async () => {
		const mockPost = {
			id: 'post-100',
			userId: 'usr_elena_dev',
			title: 'Brutalist Concrete',
			content: 'A study on dawn light.',
			aspectRatio: '4:5',
			location: 'Copenhagen, Denmark',
			cameraMeta: '35mm · ISO 200',
			likesCount: 15,
			commentsCount: 2,
			sharesCount: 1,
			createdAt: new Date()
		};

		const mockUser = {
			id: 'usr_elena_dev',
			name: 'Elena Rostova',
			handle: 'elena.rostova',
			image: 'https://example.com/avatar.jpg',
			location: 'Copenhagen, Denmark'
		};

		const { db: mockDb, viewCount } = postDb([{ post: mockPost, user: mockUser }]);

		const mockEvent = {
			params: { id: 'post-100' },
			url: new URL('http://localhost:5173/post/post-100'),
			locals: {
				user: null,
				db: mockDb
			}
		} as unknown as LoadEvent;

		const result = await load(mockEvent);
		expect(result).toBeDefined();
		if (!result) throw new Error('Expected result');
		expect(result.post.id).toBe('post-100');
		expect(result.post.title).toBe('Brutalist Concrete');
		expect(result.post.author.name).toBe('Elena Rostova');
		expect(result.post.author.handle).toBe('@elena.rostova');
		expect(result.postUrl).toBe('http://localhost:5173/post/post-100');
		// A visitor's open counts as a view.
		expect(viewCount).toHaveBeenCalledTimes(1);
	});

	it('does not count the author opening their own post as a view', async () => {
		const { db, viewCount } = postDb([
			{
				post: { id: 'post-100', userId: 'usr_elena_dev', content: 'x', createdAt: new Date() },
				user: { id: 'usr_elena_dev', name: 'Elena Rostova', handle: null, image: null }
			}
		]);
		const result = await load({
			params: { id: 'post-100' },
			url: new URL('http://localhost:5173/post/post-100'),
			locals: { user: { id: 'usr_elena_dev' }, db }
		} as unknown as LoadEvent);
		expect(result?.post.id).toBe('post-100');
		expect(viewCount).not.toHaveBeenCalled();
	});

	it('falls back to default curated posts if not found in db', async () => {
		const mockDb = {
			select: vi.fn(() => ({
				from: vi.fn(() => ({
					innerJoin: vi.fn(() => ({
						where: vi.fn(() => ({
							limit: vi.fn(async () => [])
						}))
					}))
				}))
			}))
		};

		const mockEvent = {
			params: { id: 'post-1' },
			url: new URL('http://localhost:5173/post/post-1'),
			locals: {
				user: null,
				db: mockDb
			}
		} as unknown as LoadEvent;

		const result = await load(mockEvent);
		expect(result).toBeDefined();
		if (!result) throw new Error('Expected result');
		expect(result.post.id).toBe('post-1');
		expect(result.post.author.name).toBe('Elena Rostova');
		expect(result.postUrl).toBe('http://localhost:5173/post/post-1');
	});

	it('throws 404 when post id does not exist', async () => {
		const mockDb = {
			select: vi.fn(() => ({
				from: vi.fn(() => ({
					innerJoin: vi.fn(() => ({
						where: vi.fn(() => ({
							limit: vi.fn(async () => [])
						}))
					}))
				}))
			}))
		};

		const mockEvent = {
			params: { id: 'nonexistent-post-xyz' },
			url: new URL('http://localhost:5173/post/nonexistent-post-xyz'),
			locals: {
				user: null,
				db: mockDb
			}
		} as unknown as LoadEvent;

		await expect(load(mockEvent)).rejects.toMatchObject({ status: 404 });
	});
});

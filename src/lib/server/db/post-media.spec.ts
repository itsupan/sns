import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asc } from 'drizzle-orm';
import { REAL_D1_TIMEOUT, createTestDb } from '$lib/server/testing/d1';
import { postMedia } from './schema';
import { loadPostMedia } from './posts';
import { GET as listPosts, POST as createPost } from '../../../routes/api/posts/+server';

type TestDb = Awaited<ReturnType<typeof createTestDb>>;
type Handler = (event: never) => Promise<Response>;

let t: TestDb;

// Legacy rows inserted with raw SQL, as they exist before migration 0005.
const LEGACY_POSTS = [
	// Carousel: typed video, extension-detected video, blank URL (skipped), image.
	[
		'carousel',
		JSON.stringify([
			{ url: 'https://cdn.test/a.jpg', type: 'image' },
			{ url: 'https://cdn.test/clip', type: 'video' },
			{ url: '  ' },
			{ url: 'https://cdn.test/b.MP4?sig=1' }
		]),
		'https://cdn.test/a.jpg',
		'image'
	],
	// Broken JSON falls back to the single legacy URL.
	['broken-json', '{not json', 'https://cdn.test/fallback.webp', 'image'],
	// Only the legacy single column, marked as video.
	['single-video', null, 'https://cdn.test/v', 'video'],
	// No media at all.
	['text-only', null, null, 'none']
] as const;

beforeAll(async () => {
	t = await createTestDb({ stopBefore: '0005' });
	await t.d1
		.prepare("INSERT INTO user (id, name, email) VALUES ('u-1', 'u-1', 'u-1@test.dev')")
		.run();
	for (const [id, mediaUrls, mediaUrl, mediaType] of LEGACY_POSTS) {
		await t.d1
			.prepare(
				'INSERT INTO post (id, user_id, content, media_urls, media_url, media_type) VALUES (?, ?, ?, ?, ?, ?)'
			)
			.bind(id, 'u-1', id, mediaUrls, mediaUrl, mediaType)
			.run();
	}
	await t.migrateRest();
}, 60_000);

afterAll(() => t?.dispose());

describe('post_media backfill (migration 0005)', { timeout: REAL_D1_TIMEOUT }, () => {
	it('copies legacy media in order with contiguous positions', async () => {
		const media = await loadPostMedia(
			t.db,
			LEGACY_POSTS.map(([id]) => id)
		);
		expect(media.get('carousel')).toEqual([
			{ url: 'https://cdn.test/a.jpg', type: 'image' },
			{ url: 'https://cdn.test/clip', type: 'video' },
			{ url: 'https://cdn.test/b.MP4?sig=1', type: 'video' }
		]);
		expect(media.get('broken-json')).toEqual([
			{ url: 'https://cdn.test/fallback.webp', type: 'image' }
		]);
		expect(media.get('single-video')).toEqual([{ url: 'https://cdn.test/v', type: 'video' }]);
		expect(media.has('text-only')).toBe(false);

		const positions = await t.db
			.select({ postId: postMedia.postId, position: postMedia.position })
			.from(postMedia)
			.orderBy(asc(postMedia.postId), asc(postMedia.position));
		expect(positions.filter((p) => p.postId === 'carousel').map((p) => p.position)).toEqual([
			0, 1, 2
		]);
	});
});

describe('posts API with post_media', { timeout: REAL_D1_TIMEOUT }, () => {
	function call(handler: Handler, body?: unknown) {
		const event = {
			url: new URL('http://localhost/api/posts'),
			locals: { db: t.db, user: { id: 'u-1', name: 'u-1' } },
			request: new Request('http://localhost/api/posts', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(body ?? {})
			})
		};
		return (handler as (e: typeof event) => Promise<Response>)(event);
	}

	it('stores new post media in post_media and serves it from there', async () => {
		const res = await call(createPost as Handler, {
			content: 'new carousel',
			mediaUrls: [
				{ url: 'https://cdn.test/1.jpg', type: 'image' },
				{ url: 'https://cdn.test/2.webm' }
			]
		});
		expect(res.status).toBe(201);
		const { post } = (await res.json()) as { post: { id: string } };

		expect((await loadPostMedia(t.db, [post.id])).get(post.id)).toEqual([
			{ url: 'https://cdn.test/1.jpg', type: 'image' },
			{ url: 'https://cdn.test/2.webm', type: 'video' }
		]);

		const feed = (await (await call(listPosts as Handler)).json()) as {
			posts: { id: string; mediaUrl?: string; mediaType: string; mediaItems: unknown[] }[];
		};
		const served = feed.posts.find((p) => p.id === post.id)!;
		expect(served.mediaItems).toHaveLength(2);
		expect(served.mediaUrl).toBe('https://cdn.test/1.jpg');
		expect(served.mediaType).toBe('image');

		const carousel = feed.posts.find((p) => p.id === 'carousel')!;
		expect(carousel.mediaItems).toHaveLength(3);
	});
});

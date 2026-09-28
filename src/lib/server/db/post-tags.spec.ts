import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { REAL_D1_TIMEOUT, createTestDb } from '$lib/server/testing/d1';
import { tag } from './schema';
import { loadPostTags, normalizeTags } from './posts';
import { GET as listPosts, POST as createPost } from '../../../routes/api/posts/+server';

type TestDb = Awaited<ReturnType<typeof createTestDb>>;
type Handler = (event: never) => Promise<Response>;

let t: TestDb;

// Legacy rows as they exist before migration 0007 (JSON in post.tags).
const LEGACY_POSTS: Array<[id: string, tags: string | null]> = [
	['first', JSON.stringify(['#WabiSabi', '#KyotoCraft'])],
	// Case variant of an earlier tag, missing '#', duplicate within the post, blank entry.
	['second', JSON.stringify(['wabisabi', '#Tea', '#TEA', '  ', '#KyotoCraft'])],
	['broken-json', '["#oops"'],
	['not-array', JSON.stringify({ tag: '#Nope' })],
	['no-tags', null]
];

beforeAll(async () => {
	t = await createTestDb({ stopBefore: '0007' });
	await t.d1
		.prepare("INSERT INTO user (id, name, email) VALUES ('u-1', 'u-1', 'u-1@test.dev')")
		.run();
	// Distinct created_at so "first occurrence wins" is deterministic.
	for (const [i, [id, tags]] of LEGACY_POSTS.entries()) {
		await t.d1
			.prepare('INSERT INTO post (id, user_id, content, tags, created_at) VALUES (?, ?, ?, ?, ?)')
			.bind(id, 'u-1', id, tags, 1_700_000_000_000 + i)
			.run();
	}
	await t.migrateRest();
}, 60_000);

afterAll(() => t?.dispose());

describe('normalizeTags', () => {
	it('strips #, trims, drops blanks and case-insensitive duplicates in order', () => {
		expect(normalizeTags(['#Tea', ' ##Pottery ', 'tea', '', 42, '#'])).toEqual([
			{ slug: 'tea', name: 'Tea' },
			{ slug: 'pottery', name: 'Pottery' }
		]);
		expect(normalizeTags('nope')).toEqual([]);
	});
});

describe('post_tag backfill (migration 0007)', { timeout: REAL_D1_TIMEOUT }, () => {
	it('merges case variants, keeps first spelling, order and skips bad data', async () => {
		const tags = await loadPostTags(
			t.db,
			LEGACY_POSTS.map(([id]) => id)
		);
		expect(tags.get('first')).toEqual(['#WabiSabi', '#KyotoCraft']);
		expect(tags.get('second')).toEqual(['#WabiSabi', '#Tea', '#KyotoCraft']);
		expect(tags.has('broken-json')).toBe(false);
		expect(tags.has('not-array')).toBe(false);
		expect(tags.has('no-tags')).toBe(false);

		const slugs = (await t.db.select({ slug: tag.slug }).from(tag)).map((r) => r.slug).sort();
		expect(slugs).toEqual(['kyotocraft', 'tea', 'wabisabi']);
	});

	it('finds posts by tag through the tag_id index', async () => {
		const plan = await t.d1
			.prepare(
				'EXPLAIN QUERY PLAN SELECT p.id FROM post_tag pt JOIN post p ON p.id = pt.post_id WHERE pt.tag_id = ?'
			)
			.bind('x')
			.all<{ detail: string }>();
		expect(plan.results.map((r) => r.detail).join(' | ')).toContain('post_tag_tagId_idx');
	});
});

describe('posts API with tag tables', { timeout: REAL_D1_TIMEOUT }, () => {
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

	it('stores new tags, reuses existing ones, and serves them in order', async () => {
		const res = await call(createPost as Handler, {
			content: 'fresh',
			tags: ['#Ceramics', 'wabiSABI', '#ceramics']
		});
		expect(res.status).toBe(201);
		const { post } = (await res.json()) as { post: { id: string; tags: string[] } };
		// Existing slug keeps its original display name, and the response reflects it.
		expect(post.tags).toEqual(['#Ceramics', '#WabiSabi']);

		expect((await loadPostTags(t.db, [post.id])).get(post.id)).toEqual(['#Ceramics', '#WabiSabi']);
		expect(await t.db.select().from(tag).where(eq(tag.slug, 'wabisabi'))).toHaveLength(1);

		const feed = (await (await call(listPosts as Handler)).json()) as {
			posts: { id: string; tags: string[] }[];
		};
		expect(feed.posts.find((p) => p.id === post.id)?.tags).toEqual(['#Ceramics', '#WabiSabi']);
		expect(feed.posts.find((p) => p.id === 'second')?.tags).toEqual([
			'#WabiSabi',
			'#Tea',
			'#KyotoCraft'
		]);
	});

	it('creates a post without tags', async () => {
		const res = await call(createPost as Handler, { content: 'no tags here' });
		expect(res.status).toBe(201);
		const { post } = (await res.json()) as { post: { id: string; tags: string[] } };
		expect(post.tags).toEqual([]);
		expect((await loadPostTags(t.db, [post.id])).has(post.id)).toBe(false);
	});
});

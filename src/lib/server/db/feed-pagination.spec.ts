import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REAL_D1_TIMEOUT, createTestDb } from '$lib/server/testing/d1';
import { post, user } from './schema';
import { decodeCursor, encodeCursor } from './posts';
import { GET as listPosts } from '../../../routes/api/posts/+server';

type TestDb = Awaited<ReturnType<typeof createTestDb>>;
type Handler = (event: never) => Promise<Response>;
interface FeedResponse {
	posts: { id: string }[];
	hasMore: boolean;
	nextCursor: string | null;
	nextOffset: number | null;
}

let t: TestDb;
const BASE = 1_700_000_000_000;

beforeAll(async () => {
	t = await createTestDb();
	await t.db.insert(user).values({ id: 'u-1', name: 'u-1', email: 'u-1@test.dev' });
	// 20 posts one second apart, plus 5 sharing one timestamp to exercise the id tie-break.
	const rows = [
		...Array.from({ length: 20 }, (_, i) => ({
			id: `p-${String(i).padStart(2, '0')}`,
			userId: 'u-1',
			content: `post ${i}`,
			createdAt: new Date(BASE + i * 1000)
		})),
		...['tie-a', 'tie-b', 'tie-c', 'tie-d', 'tie-e'].map((id) => ({
			id,
			userId: 'u-1',
			content: id,
			createdAt: new Date(BASE + 10_500)
		})),
		{ id: 'gone', userId: 'u-1', content: 'deleted', deletedAt: new Date() }
	];
	// D1 caps bound variables per statement at 100, so insert one row at a time.
	for (const row of rows) await t.db.insert(post).values(row);
}, 60_000);

afterAll(() => t?.dispose());

async function fetchPage(query: string): Promise<{ status: number; body: FeedResponse }> {
	const event = {
		url: new URL(`http://localhost/api/posts?${query}`),
		locals: { db: t.db, user: null }
	};
	const res = await (listPosts as Handler as (e: typeof event) => Promise<Response>)(event);
	return { status: res.status, body: (await res.json()) as FeedResponse };
}

async function walk(limit: number, between?: (page: number) => Promise<void>) {
	const seen: string[] = [];
	let cursor: string | null = null;
	for (let page = 0; page < 50; page++) {
		const { body } = await fetchPage(`limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`);
		seen.push(...body.posts.map((p) => p.id));
		if (!body.nextCursor) {
			expect(body.hasMore).toBe(false);
			return seen;
		}
		cursor = encodeURIComponent(body.nextCursor);
		await between?.(page);
	}
	throw new Error('pagination did not terminate');
}

describe('cursor helpers', () => {
	it('round-trips and rejects malformed cursors', () => {
		const c = encodeCursor({ createdAt: new Date(BASE), id: 'a_b' });
		expect(decodeCursor(c)).toEqual({ createdAt: BASE, id: 'a_b' });
		for (const bad of ['', 'abc', '12_', '_id', 'x_y', '99999999999999999_id']) {
			expect(decodeCursor(bad)).toBeNull();
		}
	});
});

describe('GET /api/posts cursor pagination on real D1', { timeout: REAL_D1_TIMEOUT }, () => {
	it('visits every live post exactly once, newest first, across pages', async () => {
		const seen = await walk(4);
		expect(seen).toHaveLength(25);
		expect(new Set(seen).size).toBe(25);
		expect(seen).not.toContain('gone');
		// Same timestamp: ordered by id descending.
		const ties = seen.filter((id) => id.startsWith('tie-'));
		expect(ties).toEqual(['tie-e', 'tie-d', 'tie-c', 'tie-b', 'tie-a']);
		expect(seen[0]).toBe('p-19');
		expect(seen.at(-1)).toBe('p-00');
	});

	it('does not duplicate or skip when new posts arrive between pages', async () => {
		let added = 0;
		const seen = await walk(3, async (page) => {
			if (page > 2) return;
			added++;
			await t.db.insert(post).values({
				id: `new-${page}`,
				userId: 'u-1',
				content: 'arrived mid-scroll',
				createdAt: new Date(BASE + 1_000_000 + page)
			});
		});
		expect(added).toBe(3);
		// New posts are newer than the cursor, so they belong to a refresh, not later pages.
		expect(seen.filter((id) => id.startsWith('new-'))).toEqual([]);
		expect(seen).toHaveLength(25);
		expect(new Set(seen).size).toBe(25);
	});

	it('rejects an invalid cursor with 400', async () => {
		const { status, body } = await fetchPage('cursor=not-a-cursor');
		expect(status).toBe(400);
		expect(body).toMatchObject({
			error: { code: 'validation_failed', fields: { cursor: 'Invalid cursor' } }
		});
	});

	it('still supports legacy offset paging for current clients', async () => {
		const first = await fetchPage('limit=5&offset=0');
		expect(first.body.nextOffset).toBe(5);
		const second = await fetchPage('limit=5&offset=5');
		expect(second.body.posts.map((p) => p.id)).not.toContain(first.body.posts[0].id);
	});

	it('uses the (created_at, id) index without a temp sort', async () => {
		const plan = await t.d1
			.prepare(
				'EXPLAIN QUERY PLAN SELECT id FROM post WHERE deleted_at IS NULL AND (created_at, id) < (?, ?) ORDER BY created_at DESC, id DESC LIMIT 11'
			)
			.bind(BASE, 'x')
			.all<{ detail: string }>();
		const detail = plan.results.map((r) => r.detail).join(' | ');
		expect(detail).toContain('post_createdAt_id_idx');
		expect(detail).not.toContain('TEMP B-TREE');
	});
});

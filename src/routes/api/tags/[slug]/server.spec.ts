import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REAL_D1_TIMEOUT, createTestDb } from '$lib/server/testing/d1';
import { post, postTag, tag, user } from '$lib/server/db/schema';
import type { ApiErrorBody } from '$lib/server/api';
import { GET } from './+server';

type Db = Awaited<ReturnType<typeof createTestDb>>['db'];

interface TagBody {
	tag: { slug: string; name: string };
	tiles: { id: string }[];
	nextCursor: string | null;
}

let db: Db;
let dispose: () => Promise<void>;

beforeAll(async () => {
	({ db, dispose } = await createTestDb());
	await db.insert(user).values({ id: 'bob', name: 'Bob', email: 'b@test.dev' });
	await db.insert(tag).values({ id: 't', slug: 'film', name: 'Film' });
	for (let i = 0; i < 3; i++) {
		await db.insert(post).values({
			id: `p${i}`,
			userId: 'bob',
			content: `#film ${i}`,
			createdAt: new Date(Date.UTC(2026, 0, 1, i))
		});
		await db.insert(postTag).values({ postId: `p${i}`, tagId: 't', position: 0 });
	}
}, 60_000);

afterAll(() => dispose?.());

function tagPage(slug: string, search = '') {
	const url = new URL(`http://localhost/api/tags/${slug}${search}`);
	const event = { params: { slug }, url, locals: { db, user: null } };
	return (GET as unknown as (e: typeof event) => Promise<Response>)(event);
}

// Order, case-insensitive slugs, deleted posts and unknown tags are covered in db/explore.spec.
describe('GET /api/tags/:slug', { timeout: REAL_D1_TIMEOUT }, () => {
	it('pages tiles newest first with a cursor', async () => {
		const first = (await (await tagPage('film', '?limit=2')).json()) as TagBody;
		expect(first.tag).toEqual({ slug: 'film', name: 'Film' });
		expect(first.tiles.map((t) => t.id)).toEqual(['p2', 'p1']);
		expect(first.nextCursor).toEqual(expect.any(String));

		const res = await tagPage('film', `?limit=2&cursor=${encodeURIComponent(first.nextCursor!)}`);
		const second = (await res.json()) as TagBody;
		expect(second.tiles.map((t) => t.id)).toEqual(['p0']);
		expect(second.nextCursor).toBeNull();
	});

	it('rejects a bad limit or cursor', async () => {
		for (const [search, field] of [
			['?limit=0', 'limit'],
			['?limit=37', 'limit'],
			['?cursor=nope', 'cursor']
		]) {
			const res = await tagPage('film', search);
			expect(res.status).toBe(400);
			expect(((await res.json()) as ApiErrorBody).error.fields).toHaveProperty(field);
		}
	});

	it('404s an unknown tag with the standard error', async () => {
		const res = await tagPage('nope');
		expect(res.status).toBe(404);
		expect(((await res.json()) as ApiErrorBody).error.code).toBe('not_found');
	});
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { REAL_D1_TIMEOUT, createTestDb } from '$lib/server/testing/d1';
import { post, postMedia, user } from './schema';
import { snippetAround, toFtsQuery } from './search';
import { GET as searchRoute } from '../../../routes/api/search/+server';

describe('toFtsQuery', () => {
	it('quotes each term so FTS5 syntax is matched literally', () => {
		expect(toFtsQuery('concrete light')).toBe('"concrete" "light"');
		expect(toFtsQuery('say "hi" there')).toBe('"say" """hi""" "there"');
		expect(toFtsQuery('foo OR bar')).toBe('"foo" "bar"');
		expect(toFtsQuery('NEAR(abc def)')).toBe('"NEAR(abc" "def)"');
		expect(toFtsQuery('col:umn abc*')).toBe('"col:umn" "abc*"');
	});

	it('strips a leading @ or # and drops terms the trigram index cannot match', () => {
		expect(toFtsQuery('@elena #wabisabi')).toBe('"elena" "wabisabi"');
		expect(toFtsQuery('a an the')).toBe('"the"');
	});

	it('returns null when nothing is searchable', () => {
		for (const q of ['', '   ', 'ab', '@', '"', '\u0000\u0001', '##']) {
			expect(toFtsQuery(q)).toBeNull();
		}
	});

	it('caps the number of terms and the input length, and dedupes', () => {
		expect(
			toFtsQuery(Array.from({ length: 20 }, (_, i) => `term${i}`).join(' '))!.split(' ')
		).toHaveLength(8);
		expect(toFtsQuery('x'.repeat(5000))).toBe(`"${'x'.repeat(100)}"`);
		expect(toFtsQuery('dup dup dup')).toBe('"dup"');
	});

	it('keeps scripts without spaces (Khmer) and emoji intact', () => {
		expect(toFtsQuery('សួស្តី')).toBe('"សួស្តី"');
		expect(toFtsQuery('🔥🔥🔥')).toBe('"🔥🔥🔥"');
	});
});

describe('snippetAround', () => {
	it('returns short text unchanged and centres long text on the first hit', () => {
		expect(snippetAround('short text', ['text'])).toBe('short text');
		const long = `${'a '.repeat(100)}needle${' b'.repeat(100)}`;
		const s = snippetAround(long, ['NEEDLE'], 40);
		expect(s).toContain('needle');
		expect(s.startsWith('…') && s.endsWith('…')).toBe(true);
	});
});

type Db = Awaited<ReturnType<typeof createTestDb>>['db'];
let db: Db;
let d1: D1Database;
let dispose: () => Promise<void>;

// Rows inserted before 0012 prove the backfill; rows after it prove the triggers.
beforeAll(async () => {
	const testDb = await createTestDb({ stopBefore: '0012' });
	({ db, d1, dispose } = testDb);
	await db.batch([
		// Raw SQL: the Drizzle user schema has columns that later migrations add.
		db.run(
			sql`INSERT INTO user (id, name, email, handle, bio) VALUES ('u-elena', 'Elena Rostova', 'e@test.dev', 'elena.rostova', 'Architectural photographer')`
		),
		db.insert(post).values({
			id: 'p-old',
			userId: 'u-elena',
			content: 'Concrete stairwell in morning light',
			location: 'Milano'
		})
	]);
	await testDb.migrateRest();

	await db.batch([
		db.insert(user).values({
			id: 'u-kai',
			name: 'Kai Takahashi',
			email: 'k@test.dev',
			handle: 'kai.raw',
			bio: 'Ceramicist who loves concrete kilns'
		}),
		db.insert(user).values({ id: 'u-sok', name: 'សុខ ធី', email: 's@test.dev' }),
		db.insert(post).values({ id: 'p-new', userId: 'u-kai', content: 'Wood-fired ceramics' }),
		db.insert(post).values({
			id: 'p-khmer',
			userId: 'u-sok',
			content: 'ថ្ងៃនេះអាកាសធាតុល្អណាស់'
		}),
		db.insert(post).values({
			id: 'p-deleted',
			userId: 'u-kai',
			content: 'Concrete draft that was deleted',
			deletedAt: new Date()
		}),
		db.insert(postMedia).values({
			id: 'm-1',
			postId: 'p-new',
			url: 'https://cdn.test/a.jpg',
			type: 'image',
			position: 0
		})
	]);
}, 60_000);

afterAll(() => dispose?.());

async function get(search: string, userId: string | null = null) {
	const url = new URL(`http://localhost/api/search${search}`);
	const event = {
		url,
		locals: { db, user: userId ? { id: userId } : null },
		getClientAddress: () => '203.0.113.9'
	};
	const res = await (searchRoute as unknown as (e: typeof event) => Promise<Response>)(event);
	return { status: res.status, body: (await res.json()) as SearchBody };
}

interface SearchBody {
	users: Array<{ id: string; slug: string; handle: string }>;
	posts: Array<{ id: string; snippet: string; thumbnail: { url: string } | null }>;
	error?: { code: string };
}

const ids = (rows: Array<{ id: string }>) => rows.map((r) => r.id);

describe('GET /api/search on real D1', { timeout: REAL_D1_TIMEOUT }, () => {
	it('finds rows that existed before the migration (backfill) and new ones (triggers)', async () => {
		const { body } = await get('?q=concrete');
		expect(ids(body.posts)).toEqual(['p-old']);
		expect(ids(body.users)).toEqual(['u-kai']);

		const ceramics = await get('?q=ceram');
		expect(ids(ceramics.body.posts)).toEqual(['p-new']);
		expect(ceramics.body.posts[0].thumbnail?.url).toBe('https://cdn.test/a.jpg');
	});

	it('never returns soft-deleted posts', async () => {
		const { body } = await get('?q=draft');
		expect(body.posts).toEqual([]);
	});

	it('matches substrings and prefixes, case-insensitively, across fields', async () => {
		expect(ids((await get('?q=ROSTOV')).body.users)).toEqual(['u-elena']);
		expect(ids((await get('?q=milan')).body.posts)).toEqual(['p-old']);
		// All terms must match (AND).
		expect(ids((await get('?q=concrete%20kilns')).body.users)).toEqual(['u-kai']);
	});

	it('finds a Khmer word inside a sentence written without spaces', async () => {
		const { body } = await get(`?q=${encodeURIComponent('អាកាសធាតុ')}`);
		expect(ids(body.posts)).toEqual(['p-khmer']);
	});

	it('ranks a handle hit above a bio hit', async () => {
		await db.insert(user).values({
			id: 'u-fan',
			name: 'Fan',
			email: 'f@test.dev',
			bio: 'Big fan of kai.raw work'
		});
		expect(ids((await get('?q=kai.raw&type=users')).body.users)).toEqual(['u-kai', 'u-fan']);
		await db.delete(user).where(eq(user.id, 'u-fan'));
	});

	it('reindexes profile edits and drops deleted users', async () => {
		await db.update(user).set({ bio: 'Now shooting glaciers' }).where(eq(user.id, 'u-elena'));
		expect(ids((await get('?q=glacier')).body.users)).toEqual(['u-elena']);
		expect(ids((await get('?q=Architectural')).body.users)).toEqual([]);

		await db.insert(user).values({ id: 'u-temp', name: 'Temporary Zebra', email: 't@test.dev' });
		expect(ids((await get('?q=zebra')).body.users)).toEqual(['u-temp']);
		await db.delete(user).where(eq(user.id, 'u-temp'));
		expect((await get('?q=zebra')).body.users).toEqual([]);
	});

	it('reindexes post edits', async () => {
		await db.update(post).set({ content: 'Anagama firing log' }).where(eq(post.id, 'p-new'));
		expect(ids((await get('?q=anagama')).body.posts)).toEqual(['p-new']);
		expect((await get('?q=ceramics')).body.posts).toEqual([]);
	});

	it('filters by type and links users by handle or id', async () => {
		const users = await get('?q=kai&type=users');
		expect(users.body.posts).toEqual([]);
		expect(users.body.users[0]).toMatchObject({ slug: 'kai.raw', handle: '@kai.raw' });
		const sok = await get(`?q=${encodeURIComponent('សុខ')}&type=users`);
		expect(sok.body.users[0].slug).toBe('u-sok');
	});

	it('never 500s on hostile or malformed input', async () => {
		const inputs = [
			'"',
			'""""',
			'OR',
			'NEAR(a b, 5)',
			'* ^ : -',
			'a" OR "b',
			'(((',
			"'; DROP TABLE post; --",
			'\u0000abc',
			'col:abc',
			'%',
			'ab'
		];
		for (const q of inputs) {
			const res = await get(`?q=${encodeURIComponent(q)}`);
			expect(res.status, q).toBe(200);
		}
		expect((await get('?type=bogus')).status).toBe(400);
		expect((await get('?q=abc&limit=999')).status).toBe(400);
		expect((await get(`?q=${'x'.repeat(300)}`)).status).toBe(400);
		expect((await db.select().from(post)).length).toBeGreaterThan(0);
	});

	it('leaves both FTS indexes consistent with their tables', async () => {
		for (const table of ['post_fts', 'user_fts']) {
			await expect(
				d1.prepare(`INSERT INTO ${table}(${table}, rank) VALUES('integrity-check', 1)`).run()
			).resolves.toBeTruthy();
		}
		const [{ n }] = await db.all<{ n: number }>(sql`select count(*) as n from post_fts`);
		expect(n).toBe((await db.select().from(post)).length);
	});
});

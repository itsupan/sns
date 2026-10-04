import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { REAL_D1_TIMEOUT, createTestDb } from '$lib/server/testing/d1';
import { post, postMedia, user } from '$lib/server/db/schema';
import { load } from './+page.server';

type Db = Awaited<ReturnType<typeof createTestDb>>['db'];

let db: Db;
let dispose: () => Promise<void>;

beforeAll(async () => {
	({ db, dispose } = await createTestDb());
	await db.batch([
		db.insert(user).values({ id: 'elena', name: 'Elena', email: 'e@test.dev', handle: 'elena' }),
		db.insert(user).values({ id: 'aoi', name: 'Aoi', email: 'a@test.dev' }),
		db
			.insert(post)
			.values({ id: 'p-1', userId: 'elena', content: 'Concrete light', title: 'Dawn' }),
		db.insert(postMedia).values([
			{ id: 'm-1', postId: 'p-1', url: 'https://cdn.test/1.jpg', type: 'image', position: 0 },
			{ id: 'm-2', postId: 'p-1', url: 'https://cdn.test/2.jpg', type: 'image', position: 1 }
		])
	]);
}, 60_000);

afterAll(() => dispose?.());

function open(id: string, viewerId: string | null) {
	return load({
		params: { id },
		locals: { db, user: viewerId ? { id: viewerId } : null },
		url: new URL(`https://sns.test/post/${id}`),
		platform: undefined
	} as never) as Promise<{
		post: { id: string; author: { name: string }; mediaItems?: unknown[] };
	}>;
}

async function views() {
	const [row] = await db.select({ views: post.viewsCount }).from(post).where(eq(post.id, 'p-1'));
	return row.views;
}

describe('/post/[id] load', { timeout: REAL_D1_TIMEOUT }, () => {
	it('loads the post with its author and media, and counts the view', async () => {
		const before = await views();
		const data = await open('p-1', 'aoi');

		expect(data.post).toMatchObject({ id: 'p-1', author: { name: 'Elena' } });
		expect(data.post.mediaItems).toHaveLength(2);
		expect(await views()).toBe(before + 1);
	});

	it('does not count the author opening their own post as a view', async () => {
		const before = await views();
		await open('p-1', 'elena');
		expect(await views()).toBe(before);
	});

	it('throws 404 when the post does not exist', async () => {
		await expect(open('missing', null)).rejects.toMatchObject({ status: 404 });
	});
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REAL_D1_TIMEOUT, createTestDb } from '$lib/server/testing/d1';
import { user } from './schema';
import { loadPostMedia, loadPostTags } from './posts';
import { MAX_MEDIA_PER_POST, MAX_TAGS_PER_POST, MAX_TAG_LENGTH } from '$lib/constants/post-limits';
import { POST as createPost } from '../../../routes/api/posts/+server';

type TestDb = Awaited<ReturnType<typeof createTestDb>>;

let t: TestDb;

beforeAll(async () => {
	t = await createTestDb();
	await t.db.insert(user).values({ id: 'u-1', name: 'u-1', email: 'u-1@test.dev' });
}, 60_000);

afterAll(() => t?.dispose());

async function create(body: unknown) {
	const event = {
		locals: { db: t.db, user: { id: 'u-1', name: 'u-1' } },
		request: new Request('http://localhost/api/posts', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		})
	};
	const res = await (createPost as unknown as (e: typeof event) => Promise<Response>)(event);
	return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

const tagsOf = (n: number, len = 8) =>
	Array.from({ length: n }, (_, i) => `#${String(i).padStart(len, 'x')}`);
const mediaOf = (n: number) =>
	Array.from({ length: n }, (_, i) => ({ url: `/api/media/posts/u-1/${i}.jpg`, type: 'image' }));

describe(
	'post size limits on real D1 (100 bound-variable cap)',
	{ timeout: REAL_D1_TIMEOUT },
	() => {
		it('stores the maximum tags at maximum length and the maximum media in one post', async () => {
			const { status, body } = await create({
				content: 'at the limits',
				tags: tagsOf(MAX_TAGS_PER_POST, MAX_TAG_LENGTH),
				mediaUrls: mediaOf(MAX_MEDIA_PER_POST)
			});
			expect(status).toBe(201);
			const id = (body.post as { id: string }).id;
			expect((await loadPostTags(t.db, [id])).get(id)).toHaveLength(MAX_TAGS_PER_POST);
			expect((await loadPostMedia(t.db, [id])).get(id)).toHaveLength(MAX_MEDIA_PER_POST);
		});

		it('rejects too many tags with 400 instead of a database error', async () => {
			const { status, body } = await create({ content: 'x', tags: tagsOf(MAX_TAGS_PER_POST + 1) });
			expect(status).toBe(400);
			expect(body).toMatchObject({
				error: { code: 'validation_failed', fields: { tags: expect.any(String) } }
			});
		});

		it('counts tags after merging case duplicates', async () => {
			const dupes = [...tagsOf(MAX_TAGS_PER_POST), ...tagsOf(5).map((t) => t.toUpperCase())];
			expect((await create({ content: 'x', tags: dupes })).status).toBe(201);
		});

		it('rejects over-long tags', async () => {
			const { status } = await create({
				content: 'x',
				tags: [`#${'a'.repeat(MAX_TAG_LENGTH + 1)}`]
			});
			expect(status).toBe(400);
		});

		it('rejects too many media items', async () => {
			const { status, body } = await create({
				content: 'x',
				mediaUrls: mediaOf(MAX_MEDIA_PER_POST + 1)
			});
			expect(status).toBe(400);
			expect(body).toMatchObject({ error: { fields: { mediaUrls: expect.any(String) } } });
		});
	}
);

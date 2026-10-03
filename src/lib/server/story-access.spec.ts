import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REAL_D1_TIMEOUT, createTestDb } from '$lib/server/testing/d1';
import { story, user, userFollow } from '$lib/server/db/schema';
import { ApiError } from '$lib/server/api';
import { requireVisibleStory } from './story-access';

type Db = Awaited<ReturnType<typeof createTestDb>>['db'];

let db: Db;
let dispose: () => Promise<void>;

const live = 'author:1000';
const expired = 'author:2000';

beforeAll(async () => {
	({ db, dispose } = await createTestDb());
	const now = Date.now();
	await db.batch([
		db
			.insert(user)
			.values(
				['author', 'follower', 'stranger'].map((id) => ({ id, name: id, email: `${id}@test.dev` }))
			),
		db.insert(userFollow).values({ followerId: 'follower', followingId: 'author' }),
		db.insert(story).values(
			[
				{ id: live, expiresAt: new Date(now + 60_000) },
				{ id: expired, expiresAt: new Date(now - 1) }
			].map((s) => ({
				...s,
				userId: 'author',
				mediaUrl: '/api/media/stories/author/a.jpg',
				mediaType: 'image' as const,
				createdAt: new Date(now - 1000)
			}))
		)
	]);
}, 60_000);

afterAll(() => dispose?.());

async function statusOf(id: string, viewerId: string) {
	try {
		await requireVisibleStory({ db } as never, id, viewerId);
		return 200;
	} catch (err) {
		if (err instanceof ApiError) return err.status;
		throw err;
	}
}

describe('requireVisibleStory', { timeout: REAL_D1_TIMEOUT }, () => {
	it('returns a live story to its author and their followers', async () => {
		for (const viewer of ['author', 'follower']) {
			expect(await requireVisibleStory({ db } as never, live, viewer)).toMatchObject({
				id: live,
				userId: 'author',
				mediaType: 'image'
			});
		}
	});

	it('is a 404 for people who do not follow the author, expired or unknown stories', async () => {
		expect(await statusOf(live, 'stranger')).toBe(404);
		expect(await statusOf(expired, 'author')).toBe(404);
		expect(await statusOf('author:3000', 'author')).toBe(404);
	});

	it('is a 400 for an id that is not <userId>:<ms>', async () => {
		expect(await statusOf('author', 'author')).toBe(400);
	});
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REAL_D1_TIMEOUT, createTestDb } from '$lib/server/testing/d1';
import { story, storyView, user } from '$lib/server/db/schema';
import { cronToken } from '$lib/server/cron-token';
import { STORY_VIEW_RETENTION_MS } from '$lib/server/stories';
import { POST } from './+server';

type Db = Awaited<ReturnType<typeof createTestDb>>['db'];

let db: Db;
let dispose: () => Promise<void>;

beforeAll(async () => {
	({ db, dispose } = await createTestDb());
	const now = Date.now();
	// Expired just inside and just outside the retention window, and still live.
	const stories = {
		'author:1': now - STORY_VIEW_RETENTION_MS - 60_000,
		'author:2': now - STORY_VIEW_RETENTION_MS + 60_000,
		'author:3': now + 60_000
	};
	await db.batch([
		db
			.insert(user)
			.values(['author', 'viewer'].map((id) => ({ id, name: id, email: `${id}@test.dev` }))),
		db.insert(story).values(
			Object.entries(stories).map(([id, expiresAt]) => ({
				id,
				userId: 'author',
				mediaUrl: '/api/media/stories/author/a.jpg',
				mediaType: 'image' as const,
				viewsCount: 1,
				createdAt: new Date(expiresAt - 86_400_000),
				expiresAt: new Date(expiresAt)
			}))
		),
		db
			.insert(storyView)
			.values(Object.keys(stories).map((storyId) => ({ storyId, viewerId: 'viewer' })))
	]);
}, 60_000);

afterAll(() => dispose?.());

function prune(token?: string) {
	const headers = token === undefined ? undefined : { 'x-cron-token': token };
	return (POST as (e: never) => Promise<Response>)({
		locals: { db },
		request: new Request('http://internal/api/cron/prune-stories', { method: 'POST', headers })
	} as never);
}

const viewedStories = async () =>
	(await db.select({ id: storyView.storyId }).from(storyView)).map((v) => v.id).sort();

describe('POST /api/cron/prune-stories', { timeout: REAL_D1_TIMEOUT }, () => {
	it('is a 404 without this isolate’s cron token', async () => {
		expect((await prune()).status).toBe(404);
		expect((await prune('guess')).status).toBe(404);
		expect(await viewedStories()).toEqual(['author:1', 'author:2', 'author:3']);
	});

	it('deletes only the views of stories expired past the retention window', async () => {
		const res = await prune(cronToken());
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ pruned: 1 });
		expect(await viewedStories()).toEqual(['author:2', 'author:3']);
		// The stories stay, so account deletion can still find their media.
		expect(await db.select({ id: story.id }).from(story)).toHaveLength(3);
	});
});

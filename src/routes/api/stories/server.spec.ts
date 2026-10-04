import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq, like } from 'drizzle-orm';
import { REAL_D1_TIMEOUT, createTestDb } from '$lib/server/testing/d1';
import {
	message,
	notification,
	story,
	storyView,
	user,
	userBlock,
	userFollow
} from '$lib/server/db/schema';
import type { ApiErrorBody } from '$lib/server/api';
import { STORY_TTL_SEC } from '$lib/server/stories';
import { GET, POST } from './+server';
import { DELETE } from './[id]/+server';
import { POST as VIEW } from './[id]/view/+server';
import { GET as VIEWS } from './[id]/views/+server';
import { POST as REACT } from './[id]/react/+server';
import { POST as REPLY } from './[id]/reply/+server';

type Db = Awaited<ReturnType<typeof createTestDb>>['db'];
type Handler = (event: never) => Promise<Response>;

interface TrayStory {
	id: string;
	caption: string | null;
	seen: boolean;
	viewCount?: number;
	reaction?: string | null;
}

interface Group {
	user: { id: string; name: string };
	isSelf: boolean;
	stories: TrayStory[];
}

interface ViewersBody {
	count: number;
	viewers: {
		id: string;
		name: string;
		viewedAt: number;
		reaction: string | null;
		isFollowing: boolean;
	}[];
	nextCursor: string | null;
}

/** Followers of "me" beyond D1's 100 bound parameters, to prove the viewers list pages. */
const FANS = Array.from({ length: 120 }, (_, i) => `fan${String(i).padStart(3, '0')}`);

let db: Db;
let dispose: () => Promise<void>;

beforeAll(async () => {
	({ db, dispose } = await createTestDb());
	// One statement per fan: D1 binds at most 100 parameters per statement.
	await db.batch([
		db.insert(user).values(
			['me', 'friend', 'stranger', 'rival'].map((id) => ({
				id,
				name: id[0].toUpperCase() + id.slice(1),
				email: `${id}@test.dev`
			}))
		),
		...FANS.map((id) => db.insert(user).values({ id, name: id, email: `${id}@test.dev` })),
		db.insert(userFollow).values([
			{ followerId: 'me', followingId: 'friend' },
			{ followerId: 'me', followingId: 'rival' }
		]),
		...FANS.map((id) => db.insert(userFollow).values({ followerId: id, followingId: 'me' }))
	]);
}, 60_000);

afterAll(() => dispose?.());

beforeEach(async () => {
	await db.batch([
		db.delete(story),
		db.delete(notification),
		db.delete(message),
		db.delete(userBlock)
	]);
});

function call(
	handler: Handler,
	{
		userId,
		body,
		id,
		query = '',
		env = {}
	}: { userId: string | null; body?: unknown; id?: string; query?: string; env?: object }
) {
	const event = {
		params: { id },
		url: new URL(`http://localhost/api/stories${query}`),
		locals: { db, user: userId ? { id: userId, name: userId } : null },
		platform: { env },
		request: new Request('http://localhost/api/stories', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body)
		})
	};
	return (handler as (e: typeof event) => Promise<Response>)(event);
}

const media = (userId: string, name = 'a.jpg') => `/api/media/stories/${userId}/${name}`;

async function share(userId: string, caption = 'hi') {
	const res = await call(POST as Handler, {
		userId,
		body: { mediaUrl: media(userId, `${caption}.jpg`), caption }
	});
	expect(res.status).toBe(201);
	return ((await res.json()) as { story: { id: string; createdAt: number; expiresAt: number } })
		.story;
}

async function groupsFor(userId: string | null) {
	const res = await call(GET as Handler, { userId });
	expect(res.status).toBe(200);
	return ((await res.json()) as { groups: Group[] }).groups;
}

const view = (userId: string | null, id: string) => call(VIEW as Handler, { userId, id });

async function viewsCountOf(id: string) {
	const [row] = await db
		.select({ viewsCount: story.viewsCount })
		.from(story)
		.where(eq(story.id, id));
	return row?.viewsCount;
}

describe('POST /api/stories', { timeout: REAL_D1_TIMEOUT }, () => {
	it('stores the story as <userId>:<ms>, expiring 24 hours later', async () => {
		const res = await call(POST as Handler, {
			userId: 'me',
			body: { mediaUrl: media('me', 'clip.mp4'), caption: '  Morning light  ', location: 'Kyoto' }
		});
		expect(res.status).toBe(201);
		const { story: created } = (await res.json()) as {
			story: {
				id: string;
				caption: string;
				mediaType: string;
				createdAt: number;
				expiresAt: number;
			};
		};
		expect(created).toMatchObject({ caption: 'Morning light', mediaType: 'video' });
		expect(created.id).toBe(`me:${created.createdAt}`);
		expect(created.expiresAt - created.createdAt).toBe(STORY_TTL_SEC * 1000);

		const rows = await db.select().from(story).where(eq(story.userId, 'me'));
		expect(rows).toEqual([
			expect.objectContaining({ id: created.id, location: 'Kyoto', viewsCount: 0 })
		]);
	});

	it('answers 409 for a second story in the same millisecond', async () => {
		const now = vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
		try {
			await share('me', 'one');
			const again = await call(POST as Handler, { userId: 'me', body: { mediaUrl: media('me') } });
			expect(again.status).toBe(409);
		} finally {
			now.mockRestore();
		}
		expect(await db.select().from(story)).toHaveLength(1);
	});

	it('only accepts media uploaded into your own stories folder', async () => {
		for (const mediaUrl of [
			media('friend'),
			'/api/media/posts/me/a.jpg',
			'https://evil.example.com/x.jpg',
			''
		]) {
			const res = await call(POST as Handler, { userId: 'me', body: { mediaUrl } });
			expect(res.status).toBe(400);
		}
		expect(await db.select().from(story)).toEqual([]);
	});

	it('validates caption length and requires sign-in', async () => {
		const long = await call(POST as Handler, {
			userId: 'me',
			body: { mediaUrl: media('me'), caption: 'x'.repeat(201) }
		});
		expect(long.status).toBe(400);
		expect(((await long.json()) as ApiErrorBody).error.fields?.caption).toBeDefined();
		expect((await call(POST as Handler, { userId: null, body: {} })).status).toBe(401);
	});
});

describe('GET /api/stories', { timeout: REAL_D1_TIMEOUT }, () => {
	it('groups own and followed users’ stories, own first, oldest first within a user', async () => {
		await share('friend', 'one');
		await share('friend', 'two');
		await share('me', 'mine');
		await share('stranger', 'nope');

		const groups = await groupsFor('me');
		expect(groups.map((g) => [g.user.id, g.isSelf])).toEqual([
			['me', true],
			['friend', false]
		]);
		expect(groups[0].user).toMatchObject({ name: 'Me' });
		expect(groups[1].stories.map((s) => s.caption)).toEqual(['one', 'two']);
	});

	it('leaves out expired stories and authors blocked either way', async () => {
		const now = Date.now();
		await db.insert(story).values({
			id: `friend:${now - STORY_TTL_SEC * 1000 - 1}`,
			userId: 'friend',
			mediaUrl: media('friend'),
			mediaType: 'image',
			createdAt: new Date(now - STORY_TTL_SEC * 1000 - 1),
			expiresAt: new Date(now - 1)
		});
		await share('rival', 'rival');
		expect((await groupsFor('me')).map((g) => g.user.id)).toEqual(['rival']);

		// The follow stays, so only the block filter keeps rival out.
		await db.insert(userBlock).values({ blockerId: 'rival', blockedId: 'me' });
		expect(await groupsFor('me')).toEqual([]);
	});

	it('marks watched stories and reactions, and gives the author a view count', async () => {
		const friendStory = await share('friend', 'f');
		const mine = await share('me', 'm');

		const friendGroup = async () => (await groupsFor('me')).find((g) => g.user.id === 'friend')!;
		expect((await friendGroup()).stories[0]).toEqual(
			expect.objectContaining({ seen: false, reaction: null })
		);
		expect((await friendGroup()).stories[0]).not.toHaveProperty('viewCount');

		await call(REACT as Handler, { userId: 'me', id: friendStory.id, body: { reaction: '🔥' } });
		expect((await friendGroup()).stories[0]).toMatchObject({ seen: true, reaction: '🔥' });

		await view(FANS[0], mine.id);
		const own = (await groupsFor('me')).find((g) => g.isSelf)!;
		expect(own.stories[0]).toMatchObject({ id: mine.id, seen: true, viewCount: 1 });
		expect(own.stories[0]).not.toHaveProperty('reaction');
	});

	it('returns an empty list when signed out', async () => {
		await share('friend');
		expect(await groupsFor(null)).toEqual([]);
	});
});

describe('DELETE /api/stories/:id', { timeout: REAL_D1_TIMEOUT }, () => {
	it('lets only the author delete, and is idempotent', async () => {
		const created = await share('me');
		expect((await call(DELETE as Handler, { userId: 'friend', id: created.id })).status).toBe(403);
		expect((await call(DELETE as Handler, { userId: 'me', id: 'nope' })).status).toBe(400);
		expect((await call(DELETE as Handler, { userId: 'me', id: created.id })).status).toBe(204);
		expect((await call(DELETE as Handler, { userId: 'me', id: created.id })).status).toBe(204);
		expect(await groupsFor('me')).toEqual([]);
	});

	it('removes its views, its reaction notifications and its media', async () => {
		const doomed = await share('friend', 'doomed');
		const kept = await share('friend', 'kept');
		for (const id of [doomed.id, kept.id]) {
			await call(REACT as Handler, { userId: 'me', id, body: { reaction: '❤️' } });
		}
		const bucket = { delete: vi.fn<(keys: string[]) => Promise<void>>(async () => undefined) };

		const res = await call(DELETE as Handler, {
			userId: 'friend',
			id: doomed.id,
			env: { R2_BUCKET: bucket }
		});
		expect(res.status).toBe(204);

		expect(await db.select().from(storyView).where(eq(storyView.storyId, doomed.id))).toEqual([]);
		expect(bucket.delete).toHaveBeenCalledWith(['stories/friend/doomed.jpg']);
		const notices = await db
			.select({ dedupeKey: notification.dedupeKey })
			.from(notification)
			.where(like(notification.dedupeKey, 'story_reaction:%'));
		expect(notices).toEqual([{ dedupeKey: `story_reaction:me:${kept.id}` }]);
	});
});

describe('story views', { timeout: REAL_D1_TIMEOUT }, () => {
	it('counts a follower once, even when views race, and never the author', async () => {
		const created = await share('friend');
		const results = await Promise.all(
			Array.from({ length: 8 }, async () => (await view('me', created.id)).json())
		);
		expect(results.filter((r) => (r as { counted: boolean }).counted)).toHaveLength(1);
		expect(await (await view('me', created.id)).json()).toEqual({ counted: false });
		expect(await (await view('friend', created.id)).json()).toEqual({ counted: false });

		expect(await viewsCountOf(created.id)).toBe(1);
		expect(await db.select().from(storyView).where(eq(storyView.storyId, created.id))).toEqual([
			expect.objectContaining({ viewerId: 'me', reaction: null })
		]);
	});

	it('only lets people who can see the story view it', async () => {
		const created = await share('friend');
		expect((await view('stranger', created.id)).status).toBe(404);
		expect((await view('me', 'friend:123')).status).toBe(404);
		expect((await view('me', 'not-an-id')).status).toBe(400);
		expect((await view(null, created.id)).status).toBe(401);
	});

	it(
		'pages through more than 100 viewers, newest first, with follow state',
		{ timeout: 120_000 },
		async () => {
			const created = await share('me');
			for (const fan of FANS) await view(fan, created.id);
			await db.insert(userFollow).values({ followerId: 'me', followingId: FANS[0] });

			const seen: ViewersBody['viewers'] = [];
			let query = '?limit=50';
			let pages = 0;
			for (;;) {
				const res = await call(VIEWS as Handler, { userId: 'me', id: created.id, query });
				expect(res.status).toBe(200);
				const body = (await res.json()) as ViewersBody;
				expect(body.count).toBe(FANS.length);
				seen.push(...body.viewers);
				pages++;
				if (!body.nextCursor) break;
				query = `?limit=50&cursor=${encodeURIComponent(body.nextCursor)}`;
			}

			await db
				.delete(userFollow)
				.where(and(eq(userFollow.followerId, 'me'), eq(userFollow.followingId, FANS[0])));
			expect(pages).toBe(3);
			expect(seen.map((v) => v.id).sort()).toEqual(FANS);
			const order = seen.map((v) => [v.viewedAt, v.id] as const);
			expect(order).toEqual(
				[...order].sort(([at1, id1], [at2, id2]) => at2 - at1 || (id2 > id1 ? 1 : -1))
			);
			expect(seen.filter((v) => v.isFollowing).map((v) => v.id)).toEqual([FANS[0]]);
			expect(seen[0]).toMatchObject({ name: FANS.at(-1), reaction: null });
		}
	);

	it('shows the list to the author only, while the story is live, minus blocked viewers', async () => {
		const created = await share('me');
		await view(FANS[0], created.id);
		await view(FANS[1], created.id);
		await db.insert(userBlock).values({ blockerId: 'me', blockedId: FANS[1] });

		const res = await call(VIEWS as Handler, { userId: 'me', id: created.id });
		const body = (await res.json()) as ViewersBody;
		expect(body.viewers.map((v) => v.id)).toEqual([FANS[0]]);
		expect(body.nextCursor).toBeNull();

		expect((await call(VIEWS as Handler, { userId: FANS[0], id: created.id })).status).toBe(403);
		expect((await call(VIEWS as Handler, { userId: 'me', id: 'me:1' })).status).toBe(404);
		const badCursor = await call(VIEWS as Handler, {
			userId: 'me',
			id: created.id,
			query: '?cursor=nope'
		});
		expect(badCursor.status).toBe(400);
	});
});

describe('story reactions and replies', { timeout: REAL_D1_TIMEOUT }, () => {
	const react = (userId: string, id: string, reaction: unknown) =>
		call(REACT as Handler, { userId, id, body: { reaction } });

	const reply = (userId: string, id: string, content: unknown) =>
		call(REPLY as Handler, { userId, id, body: { content } });

	const storyNotices = (storyId: string) =>
		db
			.select({ actorId: notification.actorId, recipientId: notification.recipientId })
			.from(notification)
			.where(
				and(
					eq(notification.type, 'story_reaction'),
					eq(notification.dedupeKey, `story_reaction:me:${storyId}`)
				)
			);

	async function viewersOf(id: string) {
		const res = await call(VIEWS as Handler, { userId: 'friend', id });
		return (await res.json()) as ViewersBody;
	}

	it('records the reaction on the view, counts the view once and notifies the author once', async () => {
		const created = await share('friend');
		expect((await react('me', created.id, '😂')).status).toBe(200);
		expect((await react('me', created.id, '❤️')).status).toBe(200);

		const body = await viewersOf(created.id);
		expect(body.count).toBe(1);
		expect(body.viewers).toEqual([expect.objectContaining({ id: 'me', reaction: '❤️' })]);
		expect(await storyNotices(created.id)).toEqual([{ actorId: 'me', recipientId: 'friend' }]);

		expect((await react('me', created.id, null)).status).toBe(200);
		expect((await viewersOf(created.id)).viewers[0].reaction).toBeNull();
		expect(await storyNotices(created.id)).toEqual([]);
		expect(await viewsCountOf(created.id)).toBe(1);
	});

	it('rejects unknown emoji, your own story, and stories you cannot see', async () => {
		const created = await share('friend');
		expect((await react('me', created.id, '💩')).status).toBe(400);
		expect((await react('friend', created.id, '❤️')).status).toBe(400);
		expect((await react('stranger', created.id, '❤️')).status).toBe(404);
		expect((await react('me', 'friend:123', '❤️')).status).toBe(404);
	});

	it('sends a reply as a DM linked to the story', async () => {
		const created = await share('friend');
		const res = await reply('me', created.id, '  Love this!  ');
		expect(res.status).toBe(201);
		const body = (await res.json()) as {
			conversationId: string;
			message: { content: string; senderId: string; storyRef: string };
		};
		expect(body.message).toMatchObject({
			content: 'Love this!',
			senderId: 'me',
			storyRef: created.id
		});
		const [stored] = await db
			.select({ storyRef: message.storyRef, conversationId: message.conversationId })
			.from(message)
			.where(eq(message.senderId, 'me'));
		expect(stored).toEqual({ storyRef: created.id, conversationId: body.conversationId });
	});

	it('rejects empty replies, replies to your own story, and blocked pairs', async () => {
		const created = await share('friend');
		expect((await reply('me', created.id, '   ')).status).toBe(400);
		expect((await reply('friend', created.id, 'hi')).status).toBe(400);
		expect((await reply('stranger', created.id, 'hi')).status).toBe(404);

		await db.insert(userBlock).values({ blockerId: 'friend', blockedId: 'me' });
		expect((await reply('me', created.id, 'hi')).status).toBe(403);
	});
});

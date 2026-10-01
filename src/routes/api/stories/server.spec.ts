import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { REAL_D1_TIMEOUT, createTestDb } from '$lib/server/testing/d1';
import { message, notification, user, userBlock, userFollow } from '$lib/server/db/schema';
import type { ApiErrorBody } from '$lib/server/api';
import { STORY_TTL_SEC, listUserStories, putStory, storyKey } from '$lib/server/stories';
import { GET, POST } from './+server';
import { DELETE } from './[id]/+server';
import { POST as VIEW } from './[id]/view/+server';
import { GET as VIEWS } from './[id]/views/+server';
import { POST as REACT } from './[id]/react/+server';
import { POST as REPLY } from './[id]/reply/+server';

type Db = Awaited<ReturnType<typeof createTestDb>>['db'];
type Handler = (event: never) => Promise<Response>;

interface Group {
	user: { id: string };
	isSelf: boolean;
	stories: { id: string; caption: string | null; mediaType: string; expiresAt: number }[];
}

let db: Db;
let kv: KVNamespace;
let dispose: () => Promise<void>;

beforeAll(async () => {
	const testDb = await createTestDb();
	({ db, dispose } = testDb);
	kv = testDb.env.STORIES;
	await db.batch([
		db.insert(user).values({ id: 'me', name: 'Me', email: 'me@test.dev' }),
		db.insert(user).values({ id: 'friend', name: 'Friend', email: 'friend@test.dev' }),
		db.insert(user).values({ id: 'stranger', name: 'Stranger', email: 'stranger@test.dev' })
	]);
	await db.insert(userFollow).values({ followerId: 'me', followingId: 'friend' });
}, 60_000);

afterAll(() => dispose?.());

beforeEach(async () => {
	const { keys } = await kv.list();
	await Promise.all(keys.map((k) => kv.delete(k.name)));
});

function call(
	handler: Handler,
	{
		userId,
		body,
		id,
		withKv = true
	}: { userId: string | null; body?: unknown; id?: string; withKv?: boolean }
) {
	const event = {
		params: { id },
		locals: { db, user: userId ? { id: userId, name: userId } : null },
		platform: { env: withKv ? { STORIES: kv } : {} },
		request: new Request('http://localhost/api/stories', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body)
		})
	};
	return (handler as (e: typeof event) => Promise<Response>)(event);
}

const media = (userId: string, name = 'a.jpg') => `/api/media/stories/${userId}/${name}`;

async function groupsFor(userId: string | null) {
	const res = await call(GET as Handler, { userId });
	expect(res.status).toBe(200);
	return ((await res.json()) as { groups: Group[] }).groups;
}

describe('POST /api/stories', { timeout: REAL_D1_TIMEOUT }, () => {
	it('writes story:<userId>:<ts> with a 24h TTL', async () => {
		const before = Date.now();
		const res = await call(POST as Handler, {
			userId: 'me',
			body: { mediaUrl: media('me', 'clip.mp4'), caption: '  Morning light  ', location: 'Kyoto' }
		});
		expect(res.status).toBe(201);
		const { story } = (await res.json()) as {
			story: { id: string; caption: string; mediaType: string; createdAt: number };
		};
		expect(story).toMatchObject({ caption: 'Morning light', mediaType: 'video' });

		const { keys } = await kv.list({ prefix: 'story:me:' });
		expect(keys.map((k) => k.name)).toEqual([storyKey('me', story.createdAt)]);
		expect(story.id).toBe(`me:${story.createdAt}`);
		// KV itself expires the key ~24h after the write.
		const expiration = keys[0].expiration!;
		expect(expiration).toBeGreaterThanOrEqual(Math.floor(before / 1000) + STORY_TTL_SEC - 1);
		expect(expiration).toBeLessThanOrEqual(Math.ceil(Date.now() / 1000) + STORY_TTL_SEC + 1);
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
		expect((await kv.list({ prefix: 'story:' })).keys).toHaveLength(0);
	});

	it('validates caption length, requires sign-in and the KV binding', async () => {
		const long = await call(POST as Handler, {
			userId: 'me',
			body: { mediaUrl: media('me'), caption: 'x'.repeat(201) }
		});
		expect(long.status).toBe(400);
		expect(((await long.json()) as ApiErrorBody).error.fields?.caption).toBeDefined();

		expect((await call(POST as Handler, { userId: null, body: {} })).status).toBe(401);
		const noKv = await call(POST as Handler, {
			userId: 'me',
			body: { mediaUrl: media('me') },
			withKv: false
		});
		expect(noKv.status).toBe(503);
	});
});

describe('GET /api/stories', { timeout: REAL_D1_TIMEOUT }, () => {
	it('returns own and followed users’ stories grouped by user, own first', async () => {
		await call(POST as Handler, {
			userId: 'friend',
			body: { mediaUrl: media('friend', '1.jpg'), caption: 'one' }
		});
		await call(POST as Handler, { userId: 'me', body: { mediaUrl: media('me') } });
		await call(POST as Handler, { userId: 'stranger', body: { mediaUrl: media('stranger') } });

		const groups = await groupsFor('me');
		expect(groups.map((g) => [g.user.id, g.isSelf])).toEqual([
			['me', true],
			['friend', false]
		]);
	});

	it('includes followed users and leaves out people you do not follow', async () => {
		await call(POST as Handler, {
			userId: 'friend',
			body: { mediaUrl: media('friend', '1.jpg'), caption: 'one' }
		});
		await call(POST as Handler, {
			userId: 'friend',
			body: { mediaUrl: media('friend', '2.jpg'), caption: 'two' }
		});
		await call(POST as Handler, { userId: 'stranger', body: { mediaUrl: media('stranger') } });

		const groups = await groupsFor('me');
		expect(groups.map((g) => g.user.id)).toEqual(['friend']);
		// Viewing order: oldest first within a user.
		expect(groups[0].stories.map((s) => s.caption)).toEqual(['one', 'two']);
		expect(groups[0].isSelf).toBe(false);
	});

	it('hides stories past 24h even if KV has not evicted them yet', async () => {
		const now = Date.now();
		await putStory(
			kv,
			{ userId: 'me', mediaUrl: media('me'), mediaType: 'image', caption: 'old', location: null },
			now - STORY_TTL_SEC * 1000 - 1
		);
		await putStory(
			kv,
			{ userId: 'me', mediaUrl: media('me'), mediaType: 'image', caption: 'fresh', location: null },
			now - 1000
		);
		expect((await listUserStories(kv, 'me', now)).map((s) => s.caption)).toEqual(['fresh']);
	});

	it('returns an empty list when signed out', async () => {
		await call(POST as Handler, { userId: 'friend', body: { mediaUrl: media('friend') } });
		expect(await groupsFor(null)).toEqual([]);
	});
});

describe('DELETE /api/stories/:id', { timeout: REAL_D1_TIMEOUT }, () => {
	it('lets the author delete their story, nobody else', async () => {
		const res = await call(POST as Handler, { userId: 'me', body: { mediaUrl: media('me') } });
		const { story } = (await res.json()) as { story: { id: string } };

		expect((await call(DELETE as Handler, { userId: 'friend', id: story.id })).status).toBe(403);
		expect((await call(DELETE as Handler, { userId: 'me', id: 'nope' })).status).toBe(400);
		expect((await call(DELETE as Handler, { userId: 'me', id: story.id })).status).toBe(204);
		expect(await groupsFor('me')).toEqual([]);
	});
});

describe('story views', { timeout: REAL_D1_TIMEOUT }, () => {
	async function share(userId: string, caption = 'hi') {
		const res = await call(POST as Handler, {
			userId,
			body: { mediaUrl: media(userId, `${caption}.jpg`), caption }
		});
		return ((await res.json()) as { story: { id: string; expiresAt: number } }).story;
	}

	async function view(userId: string | null, id: string) {
		return call(VIEW as Handler, { userId, id });
	}

	interface ViewersBody {
		count: number;
		viewers: { id: string; name: string; viewedAt: number; isFollowing: boolean }[];
	}

	it('counts a follower once, never the author, and expires with the story', async () => {
		const story = await share('friend');
		const first = await view('me', story.id);
		expect(first.status).toBe(200);
		expect(await first.json()).toEqual({ counted: true });
		expect(await (await view('me', story.id)).json()).toEqual({ counted: false });
		expect(await (await view('friend', story.id)).json()).toEqual({ counted: false });

		const { keys } = await kv.list({ prefix: `view:${story.id}:` });
		expect(keys.map((k) => k.name)).toEqual([`view:${story.id}:me`]);
		expect(keys[0].expiration).toBe(Math.floor(story.expiresAt / 1000));
	});

	it('only lets people who can see the story view it', async () => {
		const story = await share('friend');
		// "stranger" does not follow "friend".
		expect((await view('stranger', story.id)).status).toBe(404);
		expect((await view('me', 'friend:123')).status).toBe(404);
		expect((await view('me', 'not-an-id')).status).toBe(400);
		expect((await view(null, story.id)).status).toBe(401);
	});

	it('shows the author who viewed, newest first, with follow state', async () => {
		await db.insert(userFollow).values({ followerId: 'stranger', followingId: 'me' });
		try {
			const story = await share('me');
			await view('friend', story.id).catch(() => null); // friend doesn't follow me → 404, not counted
			await view('stranger', story.id);

			const res = await call(VIEWS as Handler, { userId: 'me', id: story.id });
			expect(res.status).toBe(200);
			const body = (await res.json()) as ViewersBody;
			expect(body.count).toBe(1);
			expect(body.viewers[0]).toMatchObject({
				id: 'stranger',
				name: 'Stranger',
				isFollowing: false
			});

			// Only the author may see the list.
			expect((await call(VIEWS as Handler, { userId: 'stranger', id: story.id })).status).toBe(403);
		} finally {
			await db.delete(userFollow).where(eq(userFollow.followerId, 'stranger'));
		}
	});

	it('marks stories watched across devices and gives the author a view count', async () => {
		const friendStory = await share('friend', 'f');
		const mine = await share('me', 'm');

		let groups = await groupsFor('me');
		const friendGroup = () => groups.find((g) => g.user.id === 'friend')!;
		expect(friendGroup().stories[0]).toMatchObject({ seen: false });

		await view('me', friendStory.id);
		groups = await groupsFor('me');
		expect(friendGroup().stories[0]).toMatchObject({ seen: true });

		const own = groups.find((g) => g.isSelf)!;
		expect(own.stories[0]).toMatchObject({ id: mine.id, seen: true, viewCount: 0 });
	});

	it('deleting a story removes its views too', async () => {
		const story = await share('friend');
		await view('me', story.id);
		expect((await call(DELETE as Handler, { userId: 'friend', id: story.id })).status).toBe(204);
		expect((await kv.list({ prefix: `view:${story.id}:` })).keys).toHaveLength(0);
	});
});

describe('story reactions and replies', { timeout: REAL_D1_TIMEOUT }, () => {
	async function share(userId: string) {
		const res = await call(POST as Handler, {
			userId,
			body: { mediaUrl: media(userId), caption: 'hi' }
		});
		return ((await res.json()) as { story: { id: string } }).story;
	}

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

	it('records the reaction on the view, shows it to the author and notifies them once', async () => {
		const story = await share('friend');
		expect((await react('me', story.id, '😂')).status).toBe(200);
		expect((await react('me', story.id, '❤️')).status).toBe(200);

		const res = await call(VIEWS as Handler, { userId: 'friend', id: story.id });
		const body = (await res.json()) as { viewers: { id: string; reaction: string | null }[] };
		expect(body.viewers).toEqual([expect.objectContaining({ id: 'me', reaction: '❤️' })]);
		expect(await storyNotices(story.id)).toEqual([{ actorId: 'me', recipientId: 'friend' }]);

		expect((await react('me', story.id, null)).status).toBe(200);
		const cleared = (await (
			await call(VIEWS as Handler, { userId: 'friend', id: story.id })
		).json()) as { viewers: { reaction: string | null }[] };
		expect(cleared.viewers[0].reaction).toBeNull();
		expect(await storyNotices(story.id)).toEqual([]);
	});

	it('returns your saved reaction with the stories list', async () => {
		const story = await share('friend');
		await react('me', story.id, '🔥');
		const groups = await groupsFor('me');
		const friend = groups.find((g) => g.user.id === 'friend')!;
		expect(friend.stories[0]).toMatchObject({ id: story.id, reaction: '🔥' });

		await react('me', story.id, null);
		const cleared = (await groupsFor('me')).find((g) => g.user.id === 'friend')!;
		expect(cleared.stories[0]).toMatchObject({ reaction: null });
	});

	it('rejects unknown emoji, your own story, and stories you cannot see', async () => {
		const story = await share('friend');
		expect((await react('me', story.id, '💩')).status).toBe(400);
		expect((await react('friend', story.id, '❤️')).status).toBe(400);
		expect((await react('stranger', story.id, '❤️')).status).toBe(404);
		expect((await react('me', 'friend:123', '❤️')).status).toBe(404);
	});

	it('sends a reply as a DM linked to the story', async () => {
		const story = await share('friend');
		const res = await reply('me', story.id, '  Love this!  ');
		expect(res.status).toBe(201);
		const body = (await res.json()) as {
			conversationId: string;
			message: { content: string; senderId: string; storyRef: string };
		};
		expect(body.message).toMatchObject({
			content: 'Love this!',
			senderId: 'me',
			storyRef: story.id
		});
		const [stored] = await db
			.select({ storyRef: message.storyRef, conversationId: message.conversationId })
			.from(message)
			.where(eq(message.senderId, 'me'));
		expect(stored).toEqual({ storyRef: story.id, conversationId: body.conversationId });
	});

	it('rejects empty replies, replies to your own story, and blocked pairs', async () => {
		const story = await share('friend');
		expect((await reply('me', story.id, '   ')).status).toBe(400);
		expect((await reply('friend', story.id, 'hi')).status).toBe(400);
		expect((await reply('stranger', story.id, 'hi')).status).toBe(404);

		await db.insert(userBlock).values({ blockerId: 'friend', blockedId: 'me' });
		try {
			expect((await reply('me', story.id, 'hi')).status).toBe(403);
		} finally {
			await db.delete(userBlock).where(eq(userBlock.blockerId, 'friend'));
		}
	});
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REAL_D1_TIMEOUT, createTestDb } from '$lib/server/testing/d1';
import { user } from '$lib/server/db/schema';
import { getOrCreateDm, sendMessage } from '$lib/server/db/chat';
import { setFollowing } from '$lib/server/db/follows';
import { GET } from './+server';

type Db = Awaited<ReturnType<typeof createTestDb>>['db'];

let db: Db;
let dispose: () => Promise<void>;

beforeAll(async () => {
	({ db, dispose } = await createTestDb());
	await db.batch([
		db.insert(user).values({ id: 'alice', name: 'Alice', email: 'a@test.dev' }),
		db.insert(user).values({ id: 'bob', name: 'Bob', email: 'b@test.dev' })
	]);
}, 60_000);

afterAll(() => dispose?.());

async function badges(userId: string) {
	const event = { locals: { db, user: { id: userId } } };
	const res = await (GET as unknown as (e: typeof event) => Promise<Response>)(event);
	expect(res.status).toBe(200);
	return res.json();
}

// Signed-out 401 and the activity count are covered in db/notifications.spec.
describe('GET /api/badges', { timeout: REAL_D1_TIMEOUT }, () => {
	it('counts unread messages and unread activity separately', async () => {
		const dm = await getOrCreateDm(db, 'alice', 'bob');
		await sendMessage(db, { conversationId: dm.id, senderId: 'bob', content: 'one' });
		await sendMessage(db, { conversationId: dm.id, senderId: 'bob', content: 'two' });
		await setFollowing(db, 'bob', 'alice', true);

		expect(await badges('alice')).toEqual({ messages: 2, activity: 1 });
		expect(await badges('bob')).toEqual({ messages: 0, activity: 0 });
	});
});

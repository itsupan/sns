import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REAL_D1_TIMEOUT, createTestDb } from '$lib/server/testing/d1';
import { post, postShare, user } from '$lib/server/db/schema';
import { POST } from './+server';
import type { RequestEvent } from './$types';

type Db = Awaited<ReturnType<typeof createTestDb>>['db'];

let db: Db;
let dispose: () => Promise<void>;

beforeAll(async () => {
	({ db, dispose } = await createTestDb());
	await db.batch([
		db.insert(user).values({ id: 'alice', name: 'Alice', email: 'a@test.dev' }),
		db.insert(user).values({ id: 'bob', name: 'Bob', email: 'b@test.dev' }),
		db.insert(user).values({ id: 'carol', name: 'Carol', email: 'c@test.dev' }),
		db.insert(post).values({ id: 'p-1', userId: 'alice', content: 'hello', sharesCount: 4 })
	]);
}, 60_000);

afterAll(() => dispose?.());

async function share(userId: string | null): Promise<{ status: number; sharesCount?: number }> {
	const res = await POST({
		params: { id: 'p-1' },
		locals: { db, user: userId ? { id: userId } : null }
	} as unknown as RequestEvent);
	const body = (await res.json()) as { sharesCount?: number };
	return { status: res.status, sharesCount: body.sharesCount };
}

describe('POST /api/posts/:id/share', { timeout: REAL_D1_TIMEOUT }, () => {
	it('returns 401 when unauthenticated, so shares cannot be inflated anonymously', async () => {
		expect((await share(null)).status).toBe(401);
	});

	it('counts each user once and keeps the existing count', async () => {
		expect(await share('bob')).toEqual({ status: 200, sharesCount: 5 });
		expect(await share('bob')).toEqual({ status: 200, sharesCount: 5 });
		expect(await share('carol')).toEqual({ status: 200, sharesCount: 6 });
		expect(await db.select().from(postShare)).toHaveLength(2);
	});
});

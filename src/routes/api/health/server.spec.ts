import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REAL_D1_TIMEOUT, createTestDb } from '$lib/server/testing/d1';
import { GET } from './+server';

type TestDb = Awaited<ReturnType<typeof createTestDb>>;

let db: TestDb['db'];
let env: TestDb['env'];
let dispose: () => Promise<void>;

beforeAll(async () => {
	({ db, env, dispose } = await createTestDb());
}, 60_000);

afterAll(() => dispose?.());

async function health(locals: unknown, platform: unknown) {
	const res = await (GET as unknown as (e: unknown) => Promise<Response>)({ locals, platform });
	return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

describe('GET /api/health', { timeout: REAL_D1_TIMEOUT }, () => {
	it('is ok when D1 and KV answer', async () => {
		expect(await health({ db }, { env })).toEqual({
			status: 200,
			body: { status: 'ok', database: 'ok', kv: 'ok' }
		});
	});

	it('is degraded (503) when D1 fails', async () => {
		const brokenDb = { run: () => Promise.reject(new Error('D1 unavailable')) };
		const res = await health({ db: brokenDb }, { env });
		expect(res.status).toBe(503);
		expect(res.body.status).toBe('degraded');
	});

	it('is degraded (503) when KV fails or is not bound', async () => {
		const brokenKv = { KV: { get: () => Promise.reject(new Error('KV unavailable')) } };
		expect((await health({ db }, { env: brokenKv })).status).toBe(503);
		expect((await health({ db }, undefined)).status).toBe(503);
	});
});

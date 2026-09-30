import { afterEach, describe, expect, it } from 'vitest';
import { asc } from 'drizzle-orm';
import { REAL_D1_TIMEOUT, createTestDb } from '$lib/server/testing/d1';
import { user } from './schema';
import { PATCH } from '../../../routes/api/users/[id]/+server';

type TestDb = Awaited<ReturnType<typeof createTestDb>>;
let test: TestDb | undefined;
afterEach(async () => {
	await test?.dispose();
	test = undefined;
});

const account = (id: string, handle: string | null) => ({
	id,
	name: id,
	email: `${id}@example.com`,
	handle
});

function setHandle(db: TestDb['db'], id: string, handle: string) {
	const request = new Request(`http://localhost/api/users/${id}`, {
		method: 'PATCH',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ handle })
	});
	return PATCH({ params: { id }, request, locals: { db, user: { id } } } as never);
}

describe('unique handles on real D1', { timeout: REAL_D1_TIMEOUT }, () => {
	it('lets only one of two concurrent requests take the same handle', async () => {
		test = await createTestDb();
		await test.db.insert(user).values([account('u-1', null), account('u-2', null)]);

		const statuses = (
			await Promise.all([setHandle(test.db, 'u-1', 'kai'), setHandle(test.db, 'u-2', 'kai')])
		).map((res) => res.status);

		expect(statuses.sort()).toEqual([200, 409]);
		const handles = (await test.db.select({ handle: user.handle }).from(user)).map((u) => u.handle);
		expect(handles.filter((h) => h === 'kai')).toHaveLength(1);
	});

	it('the migration keeps a duplicated handle on the oldest account only', async () => {
		test = await createTestDb({ stopBefore: '0016' });
		// Raw SQL: the Drizzle schema has columns that later migrations add.
		const insert = test.d1.prepare(
			"INSERT INTO user (id, name, email, handle) VALUES (?1, ?1, ?1 || '@example.com', ?2)"
		);
		await test.d1.batch([
			insert.bind('old', 'kai'),
			insert.bind('new', 'kai'),
			insert.bind('other', 'elena')
		]);

		await test.migrateRest();

		const rows = await test.db
			.select({ id: user.id, handle: user.handle })
			.from(user)
			.orderBy(asc(user.id));
		expect(rows).toEqual([
			{ id: 'new', handle: null },
			{ id: 'old', handle: 'kai' },
			{ id: 'other', handle: 'elena' }
		]);
	});
});

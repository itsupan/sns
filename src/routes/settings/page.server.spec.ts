import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { REAL_D1_TIMEOUT, createTestDb } from '$lib/server/testing/d1';
import { account, session, user } from '$lib/server/db/schema';
import { load } from './+page.server';

const blocked = vi.hoisted(() => ({
	rows: [] as Array<{ id: string; name: string; handle: string | null; image: string | null }>
}));
vi.mock('$lib/server/db/blocks', () => ({ listBlockedUsers: vi.fn(async () => blocked.rows) }));

type LoadEvent = Parameters<typeof load>[0];
type Db = Awaited<ReturnType<typeof createTestDb>>['db'];

const CHROME_MAC =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';
const DAY = 86_400_000;

let db: Db;
let dispose: () => Promise<void>;

beforeAll(async () => {
	({ db, dispose } = await createTestDb());
	const now = Date.now();
	const s = (id: string, userId: string, updatedAt: number, expiresAt = now + 7 * DAY) => ({
		id,
		token: `token-${id}`,
		userId,
		userAgent: CHROME_MAC,
		createdAt: new Date(now - 10 * DAY),
		updatedAt: new Date(updatedAt),
		expiresAt: new Date(expiresAt)
	});
	await db.batch([
		db.insert(user).values({ id: 'ada', name: 'Ada', email: 'ada@example.com' }),
		db
			.insert(user)
			.values({ id: 'bob', name: 'Bob', email: 'bob@example.com', emailVerified: true }),
		db.insert(account).values({
			id: 'a1',
			accountId: 'ada',
			providerId: 'credential',
			userId: 'ada',
			updatedAt: new Date()
		}),
		db.insert(account).values({
			id: 'a2',
			accountId: 'g-bob',
			providerId: 'google',
			userId: 'bob',
			updatedAt: new Date()
		}),
		db.insert(session).values(s('ada-old', 'ada', now - 3 * DAY)),
		db.insert(session).values(s('ada-now', 'ada', now)),
		db.insert(session).values(s('ada-expired', 'ada', now - 9 * DAY, now - DAY)),
		db.insert(session).values(s('bob-now', 'bob', now))
	]);
}, 60_000);

afterAll(() => dispose?.());

function event(
	me: { id: string; email: string; emailVerified: boolean; role?: string } | null,
	sessionId = ''
) {
	return {
		locals: { db, user: me, session: me ? { id: sessionId } : null },
		url: new URL('http://localhost:5173/settings?verified=1')
	} as unknown as LoadEvent;
}

describe('Settings +page.server.ts', { timeout: REAL_D1_TIMEOUT }, () => {
	it('redirects signed-out visitors to login, keeping the query', async () => {
		await expect(load(event(null))).rejects.toMatchObject({
			status: 302,
			location: expect.stringContaining('/login?redirectTo=%2Fsettings%3Fverified%3D1')
		});
	});

	it('returns the email, its status and the active sessions, newest first', async () => {
		blocked.rows = [];
		const data = await load(
			event({ id: 'ada', email: 'ada@example.com', emailVerified: false }, 'ada-now')
		);
		expect(data).toMatchObject({
			email: 'ada@example.com',
			emailVerified: false,
			hasPassword: true,
			socialProviders: [],
			blockedUsers: [],
			isModerator: false
		});
		expect(data!.sessions).toEqual([
			{
				id: 'ada-now',
				device: 'Chrome on macOS',
				createdAt: expect.any(Date),
				lastActiveAt: expect.any(Date),
				current: true
			},
			expect.objectContaining({ id: 'ada-old', current: false })
		]);
		expect(JSON.stringify(data)).not.toContain('token-');
	});

	it('reports how a Google-only account signs in', async () => {
		const data = await load(
			event({ id: 'bob', email: 'bob@example.com', emailVerified: true }, 'bob-now')
		);
		expect(data).toMatchObject({ hasPassword: false, socialProviders: ['google'] });
	});

	it('lists blocked users', async () => {
		blocked.rows = [{ id: 'u2', name: 'Bob', handle: 'bob', image: null }];
		const data = await load(
			event({ id: 'ada', email: 'ada@example.com', emailVerified: false }, 'ada-now')
		);
		expect(data!.blockedUsers).toMatchObject([{ id: 'u2', name: 'Bob', image: null }]);
	});

	it('links moderators and admins to the moderation queue', async () => {
		for (const role of ['moderator', 'admin']) {
			const data = await load(
				event({ id: 'ada', email: 'ada@example.com', emailVerified: false, role }, 'ada-now')
			);
			expect(data!.isModerator).toBe(true);
		}
	});
});

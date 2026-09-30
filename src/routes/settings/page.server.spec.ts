import { describe, expect, it, vi } from 'vitest';
import { load } from './+page.server';

const blocked = vi.hoisted(() => ({
	rows: [] as Array<{ id: string; name: string; handle: string | null; image: string | null }>
}));
vi.mock('$lib/server/db/blocks', () => ({ listBlockedUsers: vi.fn(async () => blocked.rows) }));

type LoadEvent = Parameters<typeof load>[0];

describe('Settings +page.server.ts', () => {
	it('redirects signed-out visitors to login', async () => {
		const event = {
			locals: { user: null },
			url: new URL('http://localhost:5173/settings')
		} as unknown as LoadEvent;

		await expect(load(event)).rejects.toMatchObject({
			status: 302,
			location: expect.stringContaining('/login?redirectTo=%2Fsettings')
		});
	});

	const eventWith = (rows: { id: string }[]) =>
		({
			locals: {
				user: { id: 'u1', email: 'a@example.com' },
				db: {
					select: () => ({ from: () => ({ where: () => ({ limit: async () => rows }) }) })
				}
			},
			url: new URL('http://localhost:5173/settings')
		}) as unknown as LoadEvent;

	it('returns the signed-in email and whether the account has a password', async () => {
		blocked.rows = [];
		await expect(load(eventWith([{ id: 'acc' }]))).resolves.toEqual({
			email: 'a@example.com',
			hasPassword: true,
			blockedUsers: []
		});
	});

	it('reports no password for Google-only accounts', async () => {
		blocked.rows = [];
		await expect(load(eventWith([]))).resolves.toEqual({
			email: 'a@example.com',
			hasPassword: false,
			blockedUsers: []
		});
	});

	it('lists blocked users', async () => {
		blocked.rows = [{ id: 'u2', name: 'Bob', handle: 'bob', image: null }];
		const data = (await load(eventWith([]))) as { blockedUsers: Array<{ id: string }> };
		expect(data.blockedUsers).toMatchObject([{ id: 'u2', name: 'Bob', image: null }]);
	});
});

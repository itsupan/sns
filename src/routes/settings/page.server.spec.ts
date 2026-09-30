import { describe, expect, it } from 'vitest';
import { load } from './+page.server';

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

	it('returns the signed-in email', async () => {
		const event = {
			locals: { user: { id: 'u1', email: 'a@example.com' } },
			url: new URL('http://localhost:5173/settings')
		} as unknown as LoadEvent;

		await expect(load(event)).resolves.toEqual({ email: 'a@example.com', blockedUsers: [] });
	});
});

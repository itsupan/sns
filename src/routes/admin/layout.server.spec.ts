import { describe, expect, it } from 'vitest';
import { load } from './+layout.server';
import { load as loadModerators } from './moderators/+page.server';

const layout = (user: { id: string; role?: string | null } | null) =>
	load({ locals: { user } } as never);

describe('/admin gate', () => {
	it('answers 404 to signed-out visitors and plain users', () => {
		for (const user of [null, { id: 'u' }, { id: 'u', role: null }, { id: 'u', role: 'user' }]) {
			expect(() => layout(user)).toThrow(expect.objectContaining({ status: 404 }));
		}
	});

	it('lets moderators and admins in and tells the pages which one they are', () => {
		expect(layout({ id: 'm', role: 'moderator' })).toEqual({ isAdmin: false });
		expect(layout({ id: 'a', role: 'admin' })).toEqual({ isAdmin: true });
	});

	it('hides the moderators page from moderators', async () => {
		await expect(
			loadModerators({ parent: async () => ({ isAdmin: false }) } as never)
		).rejects.toMatchObject({ status: 404 });
	});
});

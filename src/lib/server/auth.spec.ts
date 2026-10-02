import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/environment', () => ({ dev: false }));

const { createAuth } = await import('./auth');

describe('createAuth', () => {
	it.each([undefined, '', ' '.repeat(40), 'x'.repeat(31)])(
		'refuses to start outside dev with BETTER_AUTH_SECRET %j',
		(secret) => {
			const env = { BETTER_AUTH_SECRET: secret } as Env;
			expect(() => createAuth(env, {} as never)).toThrow('BETTER_AUTH_SECRET must be at least');
		}
	);

	it('starts with a 32-character secret', () => {
		const env = { BETTER_AUTH_SECRET: 'x'.repeat(32) } as Env;
		expect(() => createAuth(env, {} as never)).not.toThrow();
	});
});

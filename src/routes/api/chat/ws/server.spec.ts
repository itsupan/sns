import { describe, expect, it } from 'vitest';
import { GET } from './+server';
import type { RequestEvent } from './$types';

function connect(headers: Record<string, string>) {
	const url = new URL('https://kizuna.test/api/chat/ws');
	return GET({
		url,
		request: new Request(url, { headers: { Upgrade: 'websocket', ...headers } }),
		locals: { user: { id: 'alice' } }
	} as unknown as RequestEvent);
}

describe('GET /api/chat/ws', () => {
	it.each<Record<string, string>>([{ Origin: 'https://evil.test' }, {}])(
		'rejects upgrades from another or no origin: %o',
		async (headers) => {
			expect((await connect(headers)).status).toBe(403);
		}
	);

	it('lets our own origin through to the usual checks', async () => {
		// No conversationId: validation is the next check after the origin.
		expect((await connect({ Origin: 'https://kizuna.test' })).status).toBe(400);
	});
});

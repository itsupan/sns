import { describe, expect, it } from 'vitest';
import {
	MAX_SOCKETS_PER_USER,
	TYPING_RELAY_INTERVAL_MS,
	broadcast,
	handleClientFrame,
	socketsOverCap,
	type RoomSocket
} from './protocol';

class FakeSocket implements RoomSocket {
	sent: string[] = [];
	constructor(
		private attachment: unknown,
		private failing = false
	) {}
	send(data: string) {
		if (this.failing) throw new Error('closed');
		this.sent.push(data);
	}
	deserializeAttachment() {
		return this.attachment;
	}
	serializeAttachment(value: unknown) {
		this.attachment = value;
	}
}

const sock = (userId: string, failing = false) =>
	new FakeSocket({ userId, lastTypingAt: 0 }, failing);

describe('socketsOverCap', () => {
	const at = (connectedAt: number) => new FakeSocket({ userId: 'a', lastTypingAt: 0, connectedAt });

	it('evicts nothing while one more socket still fits', () => {
		const sockets = Array.from({ length: MAX_SOCKETS_PER_USER - 1 }, (_, i) => at(i));
		expect(socketsOverCap(sockets)).toEqual([]);
	});

	it('evicts the oldest sockets, whatever order the runtime lists them in', () => {
		const [newest, oldest, middle] = [at(30), at(10), at(20)];
		expect(socketsOverCap([newest, oldest, middle], 3)).toEqual([oldest]);
		expect(socketsOverCap([newest, oldest, middle], 2)).toEqual([oldest, middle]);
	});

	it('keeps the connection time when a typing signal rewrites the attachment', () => {
		const ws = at(10);
		handleClientFrame(ws, '{"type":"typing"}', [ws], TYPING_RELAY_INTERVAL_MS);
		expect(ws.deserializeAttachment()).toMatchObject({ connectedAt: 10 });
	});
});

describe('broadcast', () => {
	it('sends to every socket, skipping one that fails', () => {
		const a = sock('a');
		const broken = sock('b', true);
		const c = sock('c');
		broadcast([a, broken, c], { type: 'typing', userId: 'x' });
		expect(a.sent).toEqual(['{"type":"typing","userId":"x"}']);
		expect(c.sent).toHaveLength(1);
	});
});

describe('handleClientFrame', () => {
	it('relays typing to other members only, not the sender’s other tabs', () => {
		const aliceTab1 = sock('alice');
		const aliceTab2 = sock('alice');
		const bob = sock('bob');
		handleClientFrame(aliceTab1, '{"type":"typing"}', [aliceTab1, aliceTab2, bob], 10_000);
		expect(bob.sent).toEqual(['{"type":"typing","userId":"alice"}']);
		expect(aliceTab1.sent).toEqual([]);
		expect(aliceTab2.sent).toEqual([]);
	});

	it('throttles typing per socket', () => {
		const alice = sock('alice');
		const bob = sock('bob');
		const room = [alice, bob];
		handleClientFrame(alice, '{"type":"typing"}', room, 10_000);
		handleClientFrame(alice, '{"type":"typing"}', room, 10_000 + TYPING_RELAY_INTERVAL_MS - 1);
		handleClientFrame(alice, '{"type":"typing"}', room, 10_000 + TYPING_RELAY_INTERVAL_MS);
		expect(bob.sent).toHaveLength(2);
	});

	it('ignores anything that is not a typing frame', () => {
		const alice = sock('alice');
		const bob = sock('bob');
		const frames: Array<string | ArrayBuffer> = [
			'not json',
			'{"type":"message","content":"spoof"}',
			'null',
			'[]',
			new ArrayBuffer(4),
			`{"type":"typing","pad":"${'x'.repeat(300)}"}`
		];
		for (const frame of frames) handleClientFrame(alice, frame, [alice, bob], 10_000);
		expect(bob.sent).toEqual([]);
	});

	it('ignores sockets without a valid attachment', () => {
		const stray = new FakeSocket(null);
		const bob = sock('bob');
		handleClientFrame(stray, '{"type":"typing"}', [stray, bob], 10_000);
		expect(bob.sent).toEqual([]);
	});
});

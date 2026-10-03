import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONVERSATION_CLOSED_CODE, type ChatServerEvent } from '$lib/chat/types';
import { fakeChatRooms } from '$lib/server/testing/chat-rooms';
import { broadcastLater, chatRoom, closeRoomLater } from './rooms';

const event: ChatServerEvent = { type: 'typing', userId: 'alice' };

/** A platform with a fake `CHAT_ROOM` binding that collects `waitUntil` promises. */
function setup(options?: { failing?: boolean }) {
	const { namespace, stubs } = fakeChatRooms(options);
	const pending: Promise<unknown>[] = [];
	const platform = {
		env: { CHAT_ROOM: namespace },
		ctx: { waitUntil: (p: Promise<unknown>) => pending.push(p) }
	} as unknown as App.Platform;
	return { platform, stubs, pending };
}

afterEach(() => vi.restoreAllMocks());

describe('chatRoom', () => {
	it('returns the conversation’s room, keyed by its id', () => {
		const { platform, stubs } = setup();
		expect(chatRoom(platform, 'c1')).toBe(stubs.get('c1'));
		expect(chatRoom(platform, 'c1')).toBe(chatRoom(platform, 'c1'));
		expect(chatRoom(platform, 'c2')).not.toBe(chatRoom(platform, 'c1'));
	});

	it('is null without the binding or when the namespace throws', () => {
		expect(chatRoom(undefined, 'c1')).toBeNull();
		expect(chatRoom({ env: {} } as App.Platform, 'c1')).toBeNull();
		const broken = {
			env: {
				CHAT_ROOM: {
					idFromName: () => {
						throw new Error('no such class');
					}
				}
			}
		} as unknown as App.Platform;
		expect(chatRoom(broken, 'c1')).toBeNull();
	});
});

describe('broadcastLater', () => {
	it('pushes the event to the room, kept alive past the response', async () => {
		const { platform, stubs, pending } = setup();
		broadcastLater(platform, 'c1', event);
		expect(stubs.get('c1')!.broadcast).toHaveBeenCalledWith(event);
		expect(pending).toHaveLength(1);
		await expect(pending[0]).resolves.toBeUndefined();
	});

	it('swallows a failed delivery with a warning', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const { platform, pending } = setup({ failing: true });
		broadcastLater(platform, 'c1', event);
		await expect(Promise.all(pending)).resolves.toBeDefined();
		expect(warn).toHaveBeenCalledWith('[chat] broadcast failed', expect.any(Error));
	});

	it('does nothing without the binding', () => {
		expect(() => broadcastLater(undefined, 'c1', event)).not.toThrow();
	});
});

describe('closeRoomLater', () => {
	it('closes every socket with the final "conversation closed" code', async () => {
		const { platform, stubs, pending } = setup();
		closeRoomLater(platform, 'c1');
		expect(stubs.get('c1')!.closeAll).toHaveBeenCalledWith(
			CONVERSATION_CLOSED_CODE,
			'Conversation closed'
		);
		expect(pending).toHaveLength(1);
		await pending[0];
	});

	it('swallows a failed close with a warning', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const { platform, pending } = setup({ failing: true });
		closeRoomLater(platform, 'c1');
		await Promise.all(pending);
		expect(warn).toHaveBeenCalledWith('[chat] closing room failed', expect.any(Error));
	});

	it('does nothing without the binding', () => {
		expect(() => closeRoomLater(undefined, 'c1')).not.toThrow();
	});
});

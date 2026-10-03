import { vi } from 'vitest';
import type { ChatRoom } from '../chat/chat-room';

/**
 * In-memory stand-in for the `CHAT_ROOM` namespace: one stub per conversation id, whose RPCs
 * (`broadcast`, `closeAll`) are spies that resolve, or reject when `failing`.
 */
export function fakeChatRooms({ failing = false } = {}) {
	const settle = () => (failing ? Promise.reject(new Error('room down')) : Promise.resolve());
	const stubs = new Map<
		string,
		{ broadcast: ReturnType<typeof vi.fn>; closeAll: ReturnType<typeof vi.fn> }
	>();
	const namespace = {
		idFromName: (name: string) => name,
		get: (id: string) => {
			if (!stubs.has(id)) stubs.set(id, { broadcast: vi.fn(settle), closeAll: vi.fn(settle) });
			return stubs.get(id)!;
		}
	};
	return { namespace: namespace as unknown as DurableObjectNamespace<ChatRoom>, stubs };
}

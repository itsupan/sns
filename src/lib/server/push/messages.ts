import { resolve } from '$app/paths';
import type { Database } from '$lib/server/db';
import { pushTargetsOf } from '$lib/server/db/push';
import type { ChatMessage } from '$lib/chat/types';
import { deliverPushes, pushEnabled } from './send';

/** Characters of a message shown in its notification. */
const PREVIEW_LENGTH = 120;

async function pushMessage(
	db: Database,
	env: Partial<Env> | undefined,
	recipientId: string,
	senderName: string,
	message: ChatMessage
): Promise<void> {
	const body =
		message.content.length > PREVIEW_LENGTH
			? `${message.content.slice(0, PREVIEW_LENGTH - 1)}…`
			: message.content;
	const targets = await pushTargetsOf(db, recipientId);
	await deliverPushes(
		db,
		env,
		targets.map((subscription) => ({
			subscription,
			urgency: 'high',
			payload: {
				title: senderName,
				body,
				url: resolve('/messages/[id]', { id: message.conversationId }),
				tag: `dm:${message.conversationId}`
			}
		}))
	);
}

/**
 * Pushes a new direct message to the recipient's devices after the response is sent, whether or
 * not they have the chat open. Best effort, like the live broadcast.
 */
export function pushMessageLater(
	platform: App.Platform | undefined,
	db: Database,
	recipientId: string,
	senderName: string,
	message: ChatMessage
) {
	if (!pushEnabled(platform?.env)) return;
	const delivery = pushMessage(db, platform?.env, recipientId, senderName, message).catch(
		(err: unknown) => {
			console.warn('[push] message push failed', err);
		}
	);
	if (platform?.ctx?.waitUntil) platform.ctx.waitUntil(delivery);
}

import { and, eq, inArray, ne } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import type { Database } from '.';
import { postMention, user } from './schema';
import { notBlockedWith } from './blocks';
import { notifyStatement, unnotifyStatement, type NotificationTarget } from './notifications';
import { ApiError } from '$lib/server/api/errors';
import { parseMentions } from '$lib/formatting';
import { MAX_MENTIONS_PER_POST } from '$lib/constants/post-limits';

/**
 * Statements that make the post's tagged users match the @handles in `content`, for the same
 * batch as the post write: new tags are stored and notified, dropped ones are removed with their
 * notification. Unknown handles, the author and users blocked either way are ignored. `isNew`
 * skips reading tags a just-created post cannot have.
 */
export async function syncMentionsStatements(
	db: Database,
	{
		postId,
		authorId,
		content,
		isNew = false
	}: { postId: string; authorId: string; content: string; isNew?: boolean }
): Promise<BatchItem<'sqlite'>[]> {
	const handles = parseMentions(content);
	if (handles.length > MAX_MENTIONS_PER_POST) {
		const message = `You can tag at most ${MAX_MENTIONS_PER_POST} people in a post`;
		throw new ApiError(400, 'validation_failed', message, { content: message });
	}

	const [tagged, existing] = await Promise.all([
		handles.length > 0
			? db
					.select({ id: user.id })
					.from(user)
					.where(
						and(
							inArray(user.handle, handles),
							ne(user.id, authorId),
							notBlockedWith(authorId, user.id)
						)
					)
			: Promise.resolve([]),
		isNew
			? Promise.resolve([])
			: db
					.select({ id: postMention.userId })
					.from(postMention)
					.where(eq(postMention.postId, postId))
	]);

	const next = new Set(tagged.map((u) => u.id));
	const previous = new Set(existing.map((u) => u.id));
	const added = [...next].filter((id) => !previous.has(id));
	const removed = [...previous].filter((id) => !next.has(id));
	const notice = (recipientId: string): NotificationTarget => ({
		type: 'mention',
		actorId: authorId,
		recipientId,
		postId
	});

	return [
		...(added.length > 0
			? [
					db
						.insert(postMention)
						.values(added.map((userId) => ({ postId, userId })))
						.onConflictDoNothing(),
					...added.map((id) => notifyStatement(db, notice(id)))
				]
			: []),
		...(removed.length > 0
			? [
					db
						.delete(postMention)
						.where(and(eq(postMention.postId, postId), inArray(postMention.userId, removed))),
					...removed.map((id) => unnotifyStatement(db, notice(id)))
				]
			: [])
	];
}

import { and, eq, sql } from 'drizzle-orm';
import type { Database } from '.';
import { post } from './schema';
import { notDeleted } from './posts';
import { notifyStatement, unnotifyStatement } from './notifications';

/** A live post to repost, as `requireVisiblePost` returns it. */
interface RepostTarget {
	id: string;
	authorId: string;
	repostsCount: number;
}

/**
 * Reposts `target` as `userId`, or undoes the repost, and returns its reposts count. Idempotent.
 * A repost is a row of its own (post type 'repost', no content). One batch (one transaction):
 * `changes()` is the number of rows the write just before touched, so only a repost really added
 * or removed moves `reposts_count`.
 */
export async function setReposted(
	db: Database,
	userId: string,
	target: RepostTarget,
	repost: boolean
): Promise<number> {
	const notification = {
		type: 'repost',
		actorId: userId,
		recipientId: target.authorId,
		postId: target.id
	} as const;
	const write = repost
		? db
				.insert(post)
				.values({
					id: crypto.randomUUID(),
					userId,
					content: '',
					postType: 'repost',
					repostOfId: target.id
				})
				.onConflictDoNothing()
		: db
				.delete(post)
				.where(and(eq(post.userId, userId), eq(post.repostOfId, target.id), notDeleted));
	const [, updated] = await db.batch([
		write,
		db
			.update(post)
			.set({ repostsCount: sql`${post.repostsCount} + ${repost ? 1 : -1}` })
			.where(and(eq(post.id, target.id), notDeleted, sql`changes() > 0`))
			.returning({ repostsCount: post.repostsCount }),
		repost ? notifyStatement(db, notification) : unnotifyStatement(db, notification)
	]);
	return updated[0]?.repostsCount ?? target.repostsCount;
}

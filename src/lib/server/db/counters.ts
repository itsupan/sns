import { sql } from 'drizzle-orm';
import { postComment, postLike } from './schema';

/*
 * Denormalized counters are recomputed from their rows inside the same `db.batch` as the
 * write that changes them. D1 runs a batch as one transaction, so the counter always equals
 * the row count and self-heals if it ever drifted, unlike read-then-write `count + 1`.
 */

export const likesCountOf = (postId: string) =>
	sql<number>`(select count(*) from ${postLike} where ${postLike.postId} = ${postId})`;

export const commentsCountOf = (postId: string) =>
	sql<number>`(select count(*) from ${postComment} where ${postComment.postId} = ${postId})`;

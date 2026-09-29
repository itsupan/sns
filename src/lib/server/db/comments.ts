import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { Database } from '.';
import { commentReaction, post, postComment, user } from './schema';
import { commentsCountOf, reactionsCountOf, repliesCountOf } from './counters';
import { encodeCursor, notDeleted, type FeedCursor } from './posts';
import { ApiError } from '$lib/server/api/errors';
import { displayHandle, formatTimeAgo } from '$lib/utils/format';
import {
	COMMENT_REACTIONS,
	emptyReactionSummary,
	isCommentReaction,
	type CommentReaction,
	type ReactionSummary
} from '$lib/reactions';

export interface CommentDto {
	id: string;
	postId: string;
	/** Null for a top-level comment. */
	parentCommentId: string | null;
	content: string;
	createdAt: Date;
	timeAgo: string;
	repliesCount: number;
	reactions: ReactionSummary;
	/** The viewer wrote the comment or owns the post. */
	canDelete: boolean;
	author: { id: string; name: string; handle: string; avatar: string };
}

const isForeignKeyError = (err: unknown) =>
	err instanceof Error && /FOREIGN KEY constraint failed/i.test(`${err.message} ${err.cause}`);

/** The live post a comment belongs to, or a 404. */
async function requireLivePost(db: Database, postId: string) {
	const [row] = await db
		.select({ id: post.id, userId: post.userId })
		.from(post)
		.where(and(eq(post.id, postId), notDeleted))
		.limit(1);
	if (!row) throw new ApiError(404, 'not_found', 'Post not found');
	return row;
}

/** A comment on a live post with that post's author, or a 404. */
export async function requireComment(db: Database, commentId: string) {
	const [row] = await db
		.select({
			id: postComment.id,
			postId: postComment.postId,
			userId: postComment.userId,
			parentCommentId: postComment.parentCommentId,
			postAuthorId: post.userId
		})
		.from(postComment)
		.innerJoin(post, eq(post.id, postComment.postId))
		.where(and(eq(postComment.id, commentId), notDeleted))
		.limit(1);
	if (!row) throw new ApiError(404, 'not_found', 'Comment not found');
	return row;
}

/**
 * Reaction counts per type and the viewer's own reactions for many comments, in one
 * GROUP BY query. Every requested id gets an entry, empty when it has no reactions.
 */
export async function loadReactionSummaries(
	db: Database,
	commentIds: string[],
	viewerId?: string | null
): Promise<Map<string, ReactionSummary>> {
	const summaries = new Map(commentIds.map((id) => [id, emptyReactionSummary()]));
	if (commentIds.length === 0) return summaries;

	const mine = viewerId
		? sql<number>`max(${commentReaction.userId} = ${viewerId})`
		: sql<number>`0`;
	const rows = await db
		.select({
			commentId: commentReaction.commentId,
			type: commentReaction.reactionType,
			count: sql<number>`count(*)`,
			mine
		})
		.from(commentReaction)
		.where(inArray(commentReaction.commentId, commentIds))
		.groupBy(commentReaction.commentId, commentReaction.reactionType);

	for (const row of rows) {
		const summary = summaries.get(row.commentId);
		if (!summary || !isCommentReaction(row.type)) continue;
		summary.counts[row.type] = Number(row.count);
		if (Number(row.mine)) summary.mine.push(row.type);
	}
	// Stable order for clients: the picker's order.
	for (const summary of summaries.values()) {
		summary.mine.sort((x, y) => COMMENT_REACTIONS.indexOf(x) - COMMENT_REACTIONS.indexOf(y));
	}
	return summaries;
}

/**
 * One page of a post's top-level comments (`parentCommentId` null) or of one comment's
 * replies, oldest first. Keyset pagination on (created_at, id), served by
 * `post_comment_postId_parent_createdAt_idx`.
 */
export async function listComments(
	db: Database,
	{
		postId,
		parentCommentId,
		viewerId,
		limit,
		cursor
	}: {
		postId: string;
		parentCommentId: string | null;
		viewerId?: string | null;
		limit: number;
		cursor?: FeedCursor | null;
	}
) {
	const rows = await db
		.select({
			comment: {
				id: postComment.id,
				postId: postComment.postId,
				parentCommentId: postComment.parentCommentId,
				content: postComment.content,
				createdAt: postComment.createdAt,
				repliesCount: postComment.repliesCount
			},
			postAuthorId: post.userId,
			user: { id: user.id, name: user.name, handle: user.handle, image: user.image }
		})
		.from(postComment)
		.innerJoin(user, eq(postComment.userId, user.id))
		.innerJoin(post, eq(post.id, postComment.postId))
		.where(
			and(
				eq(postComment.postId, postId),
				parentCommentId === null
					? isNull(postComment.parentCommentId)
					: eq(postComment.parentCommentId, parentCommentId),
				cursor
					? sql`(${postComment.createdAt}, ${postComment.id}) > (${cursor.createdAt}, ${cursor.id})`
					: undefined
			)
		)
		.orderBy(asc(postComment.createdAt), asc(postComment.id))
		.limit(limit + 1);

	const hasMore = rows.length > limit;
	const page = hasMore ? rows.slice(0, limit) : rows;
	const reactions = await loadReactionSummaries(
		db,
		page.map((r) => r.comment.id),
		viewerId
	);

	const comments: CommentDto[] = page.map((r) => ({
		...r.comment,
		timeAgo: formatTimeAgo(r.comment.createdAt),
		reactions: reactions.get(r.comment.id) ?? emptyReactionSummary(),
		canDelete: !!viewerId && (viewerId === r.user.id || viewerId === r.postAuthorId),
		author: {
			id: r.user.id,
			name: r.user.name,
			handle: displayHandle(r.user.handle, r.user.name),
			avatar: r.user.image || ''
		}
	}));

	const last = page.at(-1);
	return {
		comments,
		hasMore,
		nextCursor: hasMore && last ? encodeCursor(last.comment) : null
	};
}

/** Top-level comments of a live post (404 when the post is missing or deleted). */
export async function listPostComments(
	db: Database,
	args: { postId: string; viewerId?: string | null; limit: number; cursor?: FeedCursor | null }
) {
	await requireLivePost(db, args.postId);
	return listComments(db, { ...args, parentCommentId: null });
}

/** Replies to a top-level comment (404 when it is missing or its post is deleted). */
export async function listReplies(
	db: Database,
	args: { commentId: string; viewerId?: string | null; limit: number; cursor?: FeedCursor | null }
) {
	const parent = await requireComment(db, args.commentId);
	return listComments(db, {
		postId: parent.postId,
		parentCommentId: parent.id,
		viewerId: args.viewerId,
		limit: args.limit,
		cursor: args.cursor
	});
}

/**
 * Adds a comment, or a reply when `parentCommentId` is set. Replies are one level deep, so the
 * parent must be a top-level comment on the same post. One batch inserts the row and recomputes
 * the post's `comments_count` (replies included) and the parent's `replies_count`.
 */
export async function createComment(
	db: Database,
	{
		postId,
		author,
		content,
		parentCommentId
	}: {
		postId: string;
		author: { id: string; name: string; handle?: string | null; image?: string | null };
		content: string;
		parentCommentId?: string | null;
	}
): Promise<{ comment: CommentDto; commentsCount: number; repliesCount: number | null }> {
	await requireLivePost(db, postId);

	if (parentCommentId) {
		const [parent] = await db
			.select({ postId: postComment.postId, parentCommentId: postComment.parentCommentId })
			.from(postComment)
			.where(eq(postComment.id, parentCommentId))
			.limit(1);
		if (!parent || parent.postId !== postId) {
			throw new ApiError(404, 'not_found', 'The comment you are replying to no longer exists');
		}
		if (parent.parentCommentId) {
			throw new ApiError(400, 'invalid_parent', 'Replies can only be added to top-level comments');
		}
	}

	const id = crypto.randomUUID();
	const createdAt = new Date();
	const updatePost = db
		.update(post)
		.set({ commentsCount: commentsCountOf(postId), updatedAt: createdAt })
		.where(eq(post.id, postId))
		.returning({ commentsCount: post.commentsCount });
	const insert = db.insert(postComment).values({
		id,
		postId,
		userId: author.id,
		content,
		parentCommentId: parentCommentId ?? null,
		createdAt,
		updatedAt: createdAt
	});

	let commentsCount: number;
	let repliesCount: number | null = null;
	try {
		if (parentCommentId) {
			const [, updatedPost, updatedParent] = await db.batch([
				insert,
				updatePost,
				db
					.update(postComment)
					.set({ repliesCount: repliesCountOf(parentCommentId) })
					.where(eq(postComment.id, parentCommentId))
					.returning({ repliesCount: postComment.repliesCount })
			]);
			commentsCount = updatedPost[0]?.commentsCount ?? 0;
			repliesCount = updatedParent[0]?.repliesCount ?? 0;
		} else {
			const [, updatedPost] = await db.batch([insert, updatePost]);
			commentsCount = updatedPost[0]?.commentsCount ?? 0;
		}
	} catch (err) {
		// The parent was deleted between the check and the insert.
		if (isForeignKeyError(err)) {
			throw new ApiError(404, 'not_found', 'The comment you are replying to no longer exists');
		}
		throw err;
	}

	return {
		comment: {
			id,
			postId,
			parentCommentId: parentCommentId ?? null,
			content,
			createdAt,
			timeAgo: formatTimeAgo(createdAt),
			repliesCount: 0,
			reactions: emptyReactionSummary(),
			canDelete: true,
			author: {
				id: author.id,
				name: author.name,
				handle: displayHandle(author.handle, author.name),
				avatar: author.image || ''
			}
		},
		commentsCount,
		repliesCount
	};
}

/**
 * Deletes a comment; its replies and reactions go with it (FK cascade). Allowed for the comment's
 * author and the post's author. Counters are recomputed in the same batch.
 */
export async function deleteComment(
	db: Database,
	{ commentId, userId }: { commentId: string; userId: string }
): Promise<{ commentsCount: number; parentCommentId: string | null; repliesCount: number | null }> {
	const target = await requireComment(db, commentId);
	if (target.userId !== userId && target.postAuthorId !== userId) {
		throw new ApiError(403, 'forbidden', 'You can only delete your own comments');
	}

	const remove = db.delete(postComment).where(eq(postComment.id, commentId));
	const updatePost = db
		.update(post)
		.set({ commentsCount: commentsCountOf(target.postId), updatedAt: new Date() })
		.where(eq(post.id, target.postId))
		.returning({ commentsCount: post.commentsCount });

	if (target.parentCommentId) {
		const [, updatedPost, updatedParent] = await db.batch([
			remove,
			updatePost,
			db
				.update(postComment)
				.set({ repliesCount: repliesCountOf(target.parentCommentId) })
				.where(eq(postComment.id, target.parentCommentId))
				.returning({ repliesCount: postComment.repliesCount })
		]);
		return {
			commentsCount: updatedPost[0]?.commentsCount ?? 0,
			parentCommentId: target.parentCommentId,
			repliesCount: updatedParent[0]?.repliesCount ?? 0
		};
	}

	const [, updatedPost] = await db.batch([remove, updatePost]);
	return {
		commentsCount: updatedPost[0]?.commentsCount ?? 0,
		parentCommentId: null,
		repliesCount: null
	};
}

/**
 * Adds the reaction if the viewer does not have it, otherwise removes it. The insert is
 * `ON CONFLICT DO NOTHING`, so a concurrent duplicate tap falls through to the delete and two
 * toggles always cancel out. `reactions_count` is recomputed in each batch.
 */
export async function toggleReaction(
	db: Database,
	{ commentId, userId, type }: { commentId: string; userId: string; type: CommentReaction }
): Promise<{ reacted: boolean; reactions: ReactionSummary }> {
	await requireComment(db, commentId);

	const recount = db
		.update(postComment)
		.set({ reactionsCount: reactionsCountOf(commentId) })
		.where(eq(postComment.id, commentId));

	let reacted: boolean;
	try {
		const [inserted] = await db.batch([
			db
				.insert(commentReaction)
				.values({ commentId, userId, reactionType: type })
				.onConflictDoNothing()
				.returning({ commentId: commentReaction.commentId }),
			recount
		]);
		reacted = inserted.length > 0;
	} catch (err) {
		if (isForeignKeyError(err)) throw new ApiError(404, 'not_found', 'Comment not found');
		throw err;
	}

	if (!reacted) {
		await db.batch([
			db
				.delete(commentReaction)
				.where(
					and(
						eq(commentReaction.commentId, commentId),
						eq(commentReaction.userId, userId),
						eq(commentReaction.reactionType, type)
					)
				),
			recount
		]);
	}

	const summaries = await loadReactionSummaries(db, [commentId], userId);
	return { reacted, reactions: summaries.get(commentId) ?? emptyReactionSummary() };
}

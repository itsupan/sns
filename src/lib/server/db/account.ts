import { and, asc, eq, inArray, isNotNull, ne, sql } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import type { Database } from './index';
import { account, session, user } from './auth-schema';
import { deleteR2Objects, extractR2Key } from '$lib/server/services/storage';
import { deleteStory, listUserStories } from '$lib/server/stories';
import {
	commentReaction,
	conversation,
	conversationMember,
	message,
	notification,
	post,
	postComment,
	postLike,
	postMedia,
	postSave,
	postTag,
	tag,
	userFollow
} from './schema';

/** Version of the export layout, bumped when fields are added or renamed. */
export const EXPORT_FORMAT_VERSION = 1;

/**
 * Everything Kizuna stores about one user, for the "Download my data" request (GDPR art. 15/20).
 * Secrets are left out: password hashes, OAuth tokens and session tokens never appear.
 */
export async function buildAccountExport(db: Database, userId: string, now = new Date()) {
	const [profile] = await db.select().from(user).where(eq(user.id, userId));
	if (!profile) return null;

	const [
		logins,
		sessions,
		posts,
		comments,
		likes,
		saves,
		reactions,
		following,
		followers,
		memberships,
		notifications
	] = await Promise.all([
		db
			.select({ provider: account.providerId, createdAt: account.createdAt })
			.from(account)
			.where(eq(account.userId, userId)),
		db
			.select({
				createdAt: session.createdAt,
				expiresAt: session.expiresAt,
				ipAddress: session.ipAddress,
				userAgent: session.userAgent
			})
			.from(session)
			.where(eq(session.userId, userId)),
		db.select().from(post).where(eq(post.userId, userId)).orderBy(asc(post.createdAt)),
		db
			.select()
			.from(postComment)
			.where(eq(postComment.userId, userId))
			.orderBy(asc(postComment.createdAt)),
		db
			.select({ postId: postLike.postId, createdAt: postLike.createdAt })
			.from(postLike)
			.where(eq(postLike.userId, userId)),
		db
			.select({ postId: postSave.postId, createdAt: postSave.createdAt })
			.from(postSave)
			.where(eq(postSave.userId, userId)),
		db
			.select({
				commentId: commentReaction.commentId,
				reactionType: commentReaction.reactionType,
				createdAt: commentReaction.createdAt
			})
			.from(commentReaction)
			.where(eq(commentReaction.userId, userId)),
		db
			.select({ userId: userFollow.followingId, handle: user.handle, since: userFollow.createdAt })
			.from(userFollow)
			.innerJoin(user, eq(user.id, userFollow.followingId))
			.where(eq(userFollow.followerId, userId)),
		db
			.select({ userId: userFollow.followerId, handle: user.handle, since: userFollow.createdAt })
			.from(userFollow)
			.innerJoin(user, eq(user.id, userFollow.followerId))
			.where(eq(userFollow.followingId, userId)),
		db
			.select({ conversationId: conversationMember.conversationId })
			.from(conversationMember)
			.where(eq(conversationMember.userId, userId)),
		db
			.select({
				type: notification.type,
				actorId: notification.actorId,
				postId: notification.postId,
				commentId: notification.commentId,
				createdAt: notification.createdAt
			})
			.from(notification)
			.where(eq(notification.recipientId, userId))
			.orderBy(asc(notification.createdAt))
	]);

	const postIds = posts.map((p) => p.id);
	const conversationIds = memberships.map((m) => m.conversationId);

	const [media, tags, members, messages] = await Promise.all([
		postIds.length
			? db
					.select({
						postId: postMedia.postId,
						url: postMedia.url,
						type: postMedia.type,
						position: postMedia.position
					})
					.from(postMedia)
					.where(inArray(postMedia.postId, postIds))
					.orderBy(asc(postMedia.position))
			: [],
		postIds.length
			? db
					.select({ postId: postTag.postId, name: tag.name })
					.from(postTag)
					.innerJoin(tag, eq(tag.id, postTag.tagId))
					.where(inArray(postTag.postId, postIds))
					.orderBy(asc(postTag.position))
			: [],
		conversationIds.length
			? db
					.select({
						conversationId: conversationMember.conversationId,
						userId: conversationMember.userId,
						handle: user.handle
					})
					.from(conversationMember)
					.innerJoin(user, eq(user.id, conversationMember.userId))
					.where(inArray(conversationMember.conversationId, conversationIds))
			: [],
		conversationIds.length
			? db
					.select({
						id: message.id,
						conversationId: message.conversationId,
						senderId: message.senderId,
						content: message.content,
						createdAt: message.createdAt,
						deletedAt: message.deletedAt
					})
					.from(message)
					.where(inArray(message.conversationId, conversationIds))
					.orderBy(asc(message.createdAt))
			: []
	]);

	const byPost = <T extends { postId: string }>(rows: T[], id: string) =>
		rows.filter((r) => r.postId === id);

	return {
		format: EXPORT_FORMAT_VERSION,
		exportedAt: now.toISOString(),
		profile: {
			id: profile.id,
			name: profile.name,
			email: profile.email,
			emailVerified: profile.emailVerified,
			handle: profile.handle,
			image: profile.image,
			bio: profile.bio,
			title: profile.title,
			website: profile.website,
			location: profile.location,
			cameraGear: profile.cameraGear,
			createdAt: profile.createdAt,
			updatedAt: profile.updatedAt
		},
		logins,
		sessions,
		posts: posts.map((p) => ({
			...p,
			media: byPost(media, p.id).map(({ url, type }) => ({ url, type })),
			tags: byPost(tags, p.id).map((t) => t.name)
		})),
		comments,
		likes,
		saves,
		commentReactions: reactions,
		following,
		followers,
		// Deleted messages keep only their metadata, as in the app.
		conversations: conversationIds.map((id) => ({
			id,
			members: members
				.filter((m) => m.conversationId === id)
				.map(({ userId, handle }) => ({ userId, handle })),
			messages: messages
				.filter((m) => m.conversationId === id)
				.map((m) => ({
					id: m.id,
					senderId: m.senderId,
					mine: m.senderId === userId,
					content: m.deletedAt ? null : m.content,
					createdAt: m.createdAt,
					deletedAt: m.deletedAt
				}))
		})),
		notifications
	};
}

export type AccountExport = NonNullable<Awaited<ReturnType<typeof buildAccountExport>>>;

/** D1 allows 100 bound parameters per statement; stay under it when listing ids. */
const ID_CHUNK = 90;

function chunks<T>(items: T[], size = ID_CHUNK): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
	return out;
}

const unique = (ids: (string | null)[]) => [...new Set(ids.filter((id): id is string => !!id))];

export interface DeleteAccountResult {
	/** R2 keys the user owned (post media, stories, avatar). */
	mediaKeys: string[];
	/** Keys that could not be deleted; logged, never blocks the deletion. */
	failedKeys: string[];
}

/**
 * Deletes a user and everything they own (GDPR art. 17). Foreign keys cascade the rows (sessions,
 * accounts, posts, comments, likes, follows, messages...); one D1 batch (one transaction) deletes
 * the user, their DMs, and recomputes the denormalized counters of other users' rows that lose
 * likes, comments, replies, reactions or follows. Media on our R2 bucket is removed afterwards;
 * R2 or KV failures are logged and do not undo the deletion.
 */
export async function deleteAccount(
	db: Database,
	env: Partial<Env> | undefined,
	userId: string
): Promise<DeleteAccountResult | null> {
	const [profile] = await db.select({ image: user.image }).from(user).where(eq(user.id, userId));
	if (!profile) return null;

	const [media, following, followers, liked, commented, replyParents, reacted, dms] =
		await Promise.all([
			db
				.select({ url: postMedia.url })
				.from(postMedia)
				.innerJoin(post, eq(post.id, postMedia.postId))
				.where(eq(post.userId, userId)),
			db
				.select({ id: userFollow.followingId })
				.from(userFollow)
				.where(eq(userFollow.followerId, userId)),
			db
				.select({ id: userFollow.followerId })
				.from(userFollow)
				.where(eq(userFollow.followingId, userId)),
			db
				.select({ id: postLike.postId })
				.from(postLike)
				.innerJoin(post, eq(post.id, postLike.postId))
				.where(and(eq(postLike.userId, userId), ne(post.userId, userId))),
			// Replies by others to the user's comments are on the same posts, so this covers them.
			db
				.selectDistinct({ id: postComment.postId })
				.from(postComment)
				.innerJoin(post, eq(post.id, postComment.postId))
				.where(and(eq(postComment.userId, userId), ne(post.userId, userId))),
			db
				.selectDistinct({ id: postComment.parentCommentId })
				.from(postComment)
				.where(and(eq(postComment.userId, userId), isNotNull(postComment.parentCommentId))),
			db
				.select({ id: commentReaction.commentId })
				.from(commentReaction)
				.where(eq(commentReaction.userId, userId)),
			db
				.select({ id: conversationMember.conversationId })
				.from(conversationMember)
				.where(eq(conversationMember.userId, userId))
		]);

	const kv = env?.STORIES;
	let stories: Awaited<ReturnType<typeof listUserStories>> = [];
	if (kv) {
		try {
			// Include stories KV has not expired yet, even past 24h.
			stories = await listUserStories(kv, userId, 0);
		} catch (err) {
			console.error('Listing stories for account deletion failed', err);
		}
	}

	const mediaKeys = unique(
		[...media.map((m) => m.url), ...stories.map((s) => s.mediaUrl), profile.image].map(extractR2Key)
	);

	const statements: BatchItem<'sqlite'>[] = [
		// Every DM has exactly two members; without the user it is unreachable, so remove it.
		...chunks(dms.map((d) => d.id)).map((ids) =>
			db.delete(conversation).where(inArray(conversation.id, ids))
		),
		db.delete(user).where(eq(user.id, userId)),
		...chunks(unique(following.map((f) => f.id))).map((ids) =>
			db
				.update(user)
				.set({
					followersCount: sql`(select count(*) from ${userFollow} where ${userFollow.followingId} = ${user.id})`
				})
				.where(inArray(user.id, ids))
		),
		...chunks(unique(followers.map((f) => f.id))).map((ids) =>
			db
				.update(user)
				.set({
					followingCount: sql`(select count(*) from ${userFollow} where ${userFollow.followerId} = ${user.id})`
				})
				.where(inArray(user.id, ids))
		),
		...chunks(unique(liked.map((l) => l.id))).map((ids) =>
			db
				.update(post)
				.set({
					likesCount: sql`(select count(*) from ${postLike} where ${postLike.postId} = ${post.id})`
				})
				.where(inArray(post.id, ids))
		),
		...chunks(unique(commented.map((c) => c.id))).map((ids) =>
			db
				.update(post)
				.set({
					commentsCount: sql`(select count(*) from ${postComment} where ${postComment.postId} = ${post.id})`
				})
				.where(inArray(post.id, ids))
		),
		...chunks(unique(replyParents.map((r) => r.id))).map((ids) =>
			db
				.update(postComment)
				.set({
					repliesCount: sql`(select count(*) from ${postComment} as r where r.parent_comment_id = ${postComment.id})`
				})
				.where(inArray(postComment.id, ids))
		),
		...chunks(unique(reacted.map((r) => r.id))).map((ids) =>
			db
				.update(postComment)
				.set({
					reactionsCount: sql`(select count(*) from ${commentReaction} where ${commentReaction.commentId} = ${postComment.id})`
				})
				.where(inArray(postComment.id, ids))
		)
	];
	await db.batch(statements as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]);

	if (kv) {
		const results = await Promise.allSettled(stories.map((s) => deleteStory(kv, s.id)));
		for (const r of results) {
			if (r.status === 'rejected') console.error('Story delete failed', r.reason);
		}
	}

	const failedKeys = await deleteR2Objects(env, mediaKeys);
	if (failedKeys.length) console.error(`Account ${userId}: R2 keys left behind`, failedKeys);
	return { mediaKeys, failedKeys };
}

import { asc, eq, inArray } from 'drizzle-orm';
import type { Database } from './index';
import { account, session, user } from './auth-schema';
import {
	commentReaction,
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

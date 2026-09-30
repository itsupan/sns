import { relations, sql } from 'drizzle-orm';
import {
	type AnySQLiteColumn,
	sqliteTable,
	text,
	integer,
	index,
	uniqueIndex,
	primaryKey
} from 'drizzle-orm/sqlite-core';
import { user } from './auth-schema';

export * from './auth-schema';

export const post = sqliteTable(
	'post',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		title: text('title'),
		content: text('content').notNull(),
		aspectRatio: text('aspect_ratio').default('1:1'), // '1:1' | '4:5' | '16:9'
		location: text('location'), // e.g. "Fondazione Prada, Milano"
		cameraMeta: text('camera_meta'),
		postType: text('post_type').default('photo').notNull(), // 'photo' | 'story' | 'article'
		likesCount: integer('likes_count').default(0).notNull(),
		commentsCount: integer('comments_count').default(0).notNull(),
		sharesCount: integer('shares_count').default(0).notNull(),
		// Times the post page was opened by someone other than the author; summed into profile impressions.
		viewsCount: integer('views_count').default(0).notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		// Soft delete: set instead of removing the row; feed and profile queries filter it out.
		deletedAt: integer('deleted_at', { mode: 'timestamp_ms' })
	},
	(table) => [
		// Feed keyset pagination: ORDER BY created_at DESC, id DESC.
		index('post_createdAt_id_idx').on(table.createdAt, table.id),
		// Profile grid: WHERE user_id = ? ORDER BY created_at DESC (also serves user_id lookups).
		index('post_userId_createdAt_idx').on(table.userId, table.createdAt)
	]
);

export const postMedia = sqliteTable(
	'post_media',
	{
		id: text('id').primaryKey(),
		postId: text('post_id')
			.notNull()
			.references(() => post.id, { onDelete: 'cascade' }),
		url: text('url').notNull(),
		type: text('type', { enum: ['image', 'video'] }).notNull(),
		width: integer('width'),
		height: integer('height'),
		// 0-based order within the post's carousel.
		position: integer('position').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull()
	},
	(table) => [uniqueIndex('post_media_postId_position_unique').on(table.postId, table.position)]
);

export const tag = sqliteTable('tag', {
	id: text('id').primaryKey(),
	// Lowercase name without '#': merges case variants (#WabiSabi = #wabisabi).
	slug: text('slug').notNull().unique(),
	// Display form of the first occurrence, without '#'.
	name: text('name').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull()
});

export const postTag = sqliteTable(
	'post_tag',
	{
		postId: text('post_id')
			.notNull()
			.references(() => post.id, { onDelete: 'cascade' }),
		tagId: text('tag_id')
			.notNull()
			.references(() => tag.id, { onDelete: 'cascade' }),
		// 0-based order as the author wrote them.
		position: integer('position').notNull()
	},
	(table) => [
		primaryKey({ columns: [table.postId, table.tagId] }),
		// Posts by tag: WHERE tag_id = ?
		index('post_tag_tagId_idx').on(table.tagId)
	]
);

export const postLike = sqliteTable(
	'post_like',
	{
		id: text('id').primaryKey(),
		postId: text('post_id')
			.notNull()
			.references(() => post.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull()
	},
	(table) => [
		uniqueIndex('post_like_postId_userId_unique').on(table.postId, table.userId),
		index('post_like_userId_idx').on(table.userId),
		index('post_like_postId_idx').on(table.postId)
	]
);

export const postSave = sqliteTable(
	'post_save',
	{
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		postId: text('post_id')
			.notNull()
			.references(() => post.id, { onDelete: 'cascade' }),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull()
	},
	(table) => [
		// One row per pair: makes save idempotent (INSERT … ON CONFLICT DO NOTHING).
		primaryKey({ columns: [table.userId, table.postId] }),
		// Saved list: WHERE user_id = ? ORDER BY created_at DESC, post_id DESC.
		index('post_save_userId_createdAt_idx').on(table.userId, table.createdAt, table.postId)
	]
);

export const postComment = sqliteTable(
	'post_comment',
	{
		id: text('id').primaryKey(),
		postId: text('post_id')
			.notNull()
			.references(() => post.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		content: text('content').notNull(),
		// Replies are one level deep: a reply's parent is always a top-level comment.
		parentCommentId: text('parent_comment_id').references((): AnySQLiteColumn => postComment.id, {
			onDelete: 'cascade'
		}),
		repliesCount: integer('replies_count').default(0).notNull(),
		reactionsCount: integer('reactions_count').default(0).notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull()
	},
	(table) => [
		// Top-level comments (parent IS NULL) or one comment's replies, oldest first, keyset on (created_at, id).
		index('post_comment_postId_parent_createdAt_idx').on(
			table.postId,
			table.parentCommentId,
			table.createdAt,
			table.id
		),
		index('post_comment_postId_idx').on(table.postId),
		index('post_comment_userId_idx').on(table.userId),
		index('post_comment_createdAt_idx').on(table.createdAt)
	]
);

export const commentReaction = sqliteTable(
	'comment_reaction',
	{
		commentId: text('comment_id')
			.notNull()
			.references(() => postComment.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		// One of COMMENT_REACTIONS ($lib/reactions); validated at the API layer.
		reactionType: text('reaction_type').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull()
	},
	(table) => [
		// At most one of each reaction type per user per comment.
		primaryKey({ columns: [table.commentId, table.userId, table.reactionType] }),
		index('comment_reaction_commentId_idx').on(table.commentId)
	]
);

export const userFollow = sqliteTable(
	'user_follow',
	{
		followerId: text('follower_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		followingId: text('following_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull()
	},
	(table) => [
		// One row per pair: makes follow idempotent (INSERT … ON CONFLICT DO NOTHING).
		primaryKey({ columns: [table.followerId, table.followingId] }),
		// Followers list: WHERE following_id = ? ORDER BY created_at DESC, follower_id DESC.
		index('user_follow_followingId_createdAt_idx').on(
			table.followingId,
			table.createdAt,
			table.followerId
		),
		// Following list: WHERE follower_id = ? ORDER BY created_at DESC, following_id DESC.
		index('user_follow_followerId_createdAt_idx').on(
			table.followerId,
			table.createdAt,
			table.followingId
		)
	]
);

/** A block: `blockerId` blocked `blockedId`. Blocks hide both users from each other everywhere. */
export const userBlock = sqliteTable(
	'user_block',
	{
		blockerId: text('blocker_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		blockedId: text('blocked_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull()
	},
	(table) => [
		// One row per pair: makes block idempotent (INSERT … ON CONFLICT DO NOTHING).
		primaryKey({ columns: [table.blockerId, table.blockedId] }),
		// "Who blocked me": WHERE blocked_id = ?.
		index('user_block_blockedId_idx').on(table.blockedId)
	]
);

export const postRelations = relations(post, ({ one, many }) => ({
	user: one(user, {
		fields: [post.userId],
		references: [user.id]
	}),
	media: many(postMedia),
	tags: many(postTag),
	likes: many(postLike),
	comments: many(postComment)
}));

export const tagRelations = relations(tag, ({ many }) => ({
	posts: many(postTag)
}));

export const postTagRelations = relations(postTag, ({ one }) => ({
	post: one(post, {
		fields: [postTag.postId],
		references: [post.id]
	}),
	tag: one(tag, {
		fields: [postTag.tagId],
		references: [tag.id]
	})
}));

export const postMediaRelations = relations(postMedia, ({ one }) => ({
	post: one(post, {
		fields: [postMedia.postId],
		references: [post.id]
	})
}));

export const postLikeRelations = relations(postLike, ({ one }) => ({
	post: one(post, {
		fields: [postLike.postId],
		references: [post.id]
	}),
	user: one(user, {
		fields: [postLike.userId],
		references: [user.id]
	})
}));

export const postCommentRelations = relations(postComment, ({ one }) => ({
	post: one(post, {
		fields: [postComment.postId],
		references: [post.id]
	}),
	user: one(user, {
		fields: [postComment.userId],
		references: [user.id]
	})
}));

export const conversation = sqliteTable('conversation', {
	id: text('id').primaryKey(),
	// Direct messages: the two member ids sorted and joined with ':'. Unique, so starting a DM
	// twice (even concurrently) always lands in the same conversation.
	dmKey: text('dm_key').notNull().unique(),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	// Inbox order; null until the first message.
	lastMessageAt: integer('last_message_at', { mode: 'timestamp_ms' })
});

export const conversationMember = sqliteTable(
	'conversation_member',
	{
		conversationId: text('conversation_id')
			.notNull()
			.references(() => conversation.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		// Messages after this are unread for the member; null means nothing read yet.
		lastReadAt: integer('last_read_at', { mode: 'timestamp_ms' }),
		// Copy of conversation.last_message_at so a member's inbox is one index range scan.
		lastMessageAt: integer('last_message_at', { mode: 'timestamp_ms' })
	},
	(table) => [
		primaryKey({ columns: [table.conversationId, table.userId] }),
		// Inbox: WHERE user_id = ? ORDER BY last_message_at DESC, conversation_id DESC.
		index('conversation_member_userId_lastMessageAt_idx').on(
			table.userId,
			table.lastMessageAt,
			table.conversationId
		)
	]
);

export const message = sqliteTable(
	'message',
	{
		id: text('id').primaryKey(),
		conversationId: text('conversation_id')
			.notNull()
			.references(() => conversation.id, { onDelete: 'cascade' }),
		senderId: text('sender_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		content: text('content').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		deletedAt: integer('deleted_at', { mode: 'timestamp_ms' })
	},
	(table) => [
		// History keyset pagination: WHERE conversation_id = ? ORDER BY created_at, id.
		index('message_conversationId_createdAt_idx').on(
			table.conversationId,
			table.createdAt,
			table.id
		)
	]
);

export const NOTIFICATION_TYPES = ['like', 'comment', 'reply', 'reaction', 'follow'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/**
 * Activity addressed to `recipient_id`, written in the same batch as the action that causes it and
 * removed when that action is undone. Comment, reply and reaction notifications cascade away with
 * their comment; notifications about a soft-deleted post are filtered out on read.
 */
export const notification = sqliteTable(
	'notification',
	{
		id: text('id').primaryKey(),
		recipientId: text('recipient_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		actorId: text('actor_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		type: text('type', { enum: NOTIFICATION_TYPES }).notNull(),
		postId: text('post_id').references(() => post.id, { onDelete: 'cascade' }),
		commentId: text('comment_id').references(() => postComment.id, { onDelete: 'cascade' }),
		// Identifies the action (e.g. `like:<actor>:<post>`), so repeats and undo hit one row.
		dedupeKey: text('dedupe_key').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull()
	},
	(table) => [
		uniqueIndex('notification_dedupeKey_unique').on(table.dedupeKey),
		// Activity list and unread count: WHERE recipient_id = ? ORDER BY created_at DESC, id DESC.
		index('notification_recipientId_createdAt_idx').on(table.recipientId, table.createdAt, table.id)
	]
);

/** When each user last opened Activity; notifications created after it are unread. */
export const notificationRead = sqliteTable('notification_read', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	readAt: integer('read_at', { mode: 'timestamp_ms' }).notNull()
});

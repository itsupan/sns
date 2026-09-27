import { relations, sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
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
		mediaUrl: text('media_url'),
		mediaType: text('media_type').default('none').notNull(), // 'image' | 'video' | 'none'
		mediaUrls: text('media_urls'), // JSON string array of media items: [{ url: string, type: 'image' | 'video' }]
		aspectRatio: text('aspect_ratio').default('1:1'), // '1:1' | '4:5' | '16:9'
		location: text('location'), // e.g. "Fondazione Prada, Milano"
		cameraMeta: text('camera_meta'),
		tags: text('tags'), // JSON string array of tags e.g. ["#MinimalArchitecture"]
		postType: text('post_type').default('photo').notNull(), // 'photo' | 'story' | 'article'
		likesCount: integer('likes_count').default(0).notNull(),
		commentsCount: integer('comments_count').default(0).notNull(),
		sharesCount: integer('shares_count').default(0).notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull()
	},
	(table) => [
		index('post_userId_idx').on(table.userId),
		index('post_createdAt_idx').on(table.createdAt)
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
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull()
	},
	(table) => [
		index('post_comment_postId_idx').on(table.postId),
		index('post_comment_userId_idx').on(table.userId),
		index('post_comment_createdAt_idx').on(table.createdAt)
	]
);

export const postRelations = relations(post, ({ one, many }) => ({
	user: one(user, {
		fields: [post.userId],
		references: [user.id]
	}),
	likes: many(postLike),
	comments: many(postComment)
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

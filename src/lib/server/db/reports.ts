import { and, eq, isNull } from 'drizzle-orm';
import type { Database } from '.';
import {
	conversationMember,
	message,
	post,
	postComment,
	report,
	user,
	type ReportReason,
	type ReportTargetType
} from './schema';
import { notDeleted } from './posts';

/**
 * The user responsible for a report target (the author, sender, or the user themself), or null
 * when the target does not exist or `reporterId` may not see it: posts must not be deleted,
 * comments must be on a live post, and messages must be in a conversation the reporter belongs to.
 */
export async function findReportTargetOwner(
	db: Database,
	reporterId: string,
	targetType: ReportTargetType,
	targetId: string
): Promise<string | null> {
	let rows: { ownerId: string }[];
	switch (targetType) {
		case 'post':
			rows = await db
				.select({ ownerId: post.userId })
				.from(post)
				.where(and(eq(post.id, targetId), notDeleted))
				.limit(1);
			break;
		case 'comment':
			rows = await db
				.select({ ownerId: postComment.userId })
				.from(postComment)
				.innerJoin(post, eq(postComment.postId, post.id))
				.where(and(eq(postComment.id, targetId), notDeleted))
				.limit(1);
			break;
		case 'user':
			rows = await db.select({ ownerId: user.id }).from(user).where(eq(user.id, targetId)).limit(1);
			break;
		case 'message':
			rows = await db
				.select({ ownerId: message.senderId })
				.from(message)
				.innerJoin(
					conversationMember,
					and(
						eq(conversationMember.conversationId, message.conversationId),
						eq(conversationMember.userId, reporterId)
					)
				)
				.where(and(eq(message.id, targetId), isNull(message.deletedAt)))
				.limit(1);
			break;
	}
	return rows[0]?.ownerId ?? null;
}

/**
 * Files a report. Returns `created: false` when the reporter already has an open report on the
 * same target (the partial unique index makes this race-safe).
 */
export async function createReport(
	db: Database,
	input: {
		reporterId: string;
		targetType: ReportTargetType;
		targetId: string;
		reason: ReportReason;
		details: string | null;
	}
): Promise<{ created: boolean }> {
	const inserted = await db
		.insert(report)
		.values({ id: crypto.randomUUID(), ...input })
		.onConflictDoNothing()
		.returning({ id: report.id });
	return { created: inserted.length > 0 };
}

import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '.';
import { poll, pollOption, pollVote } from './schema';
import { ApiError } from '$lib/server/api';
import type { PollData, PollInput } from '$lib/polls';

/** Statements creating `postId`'s poll; it closes `durationMinutes` from `now`. */
export function insertPollStatements(db: Database, postId: string, input: PollInput, now: Date) {
	return [
		db
			.insert(poll)
			.values({ postId, closesAt: new Date(now.getTime() + input.durationMinutes * 60_000) }),
		db.insert(pollOption).values(
			input.options.map((label, position) => ({
				id: crypto.randomUUID(),
				postId,
				position,
				label
			}))
		)
	] as const;
}

/**
 * The polls of `postIds` (one feed page), keyed by post id, with the viewer's vote: two indexed
 * lookups.
 */
export async function loadPolls(
	db: Database,
	viewerId: string | null | undefined,
	postIds: string[],
	now = new Date()
): Promise<Map<string, PollData>> {
	if (postIds.length === 0) return new Map();
	const [options, votes] = await Promise.all([
		db
			.select({ option: pollOption, closesAt: poll.closesAt })
			.from(pollOption)
			.innerJoin(poll, eq(poll.postId, pollOption.postId))
			.where(inArray(pollOption.postId, postIds))
			.orderBy(asc(pollOption.position)),
		viewerId
			? db
					.select({ postId: pollVote.postId, optionId: pollVote.optionId })
					.from(pollVote)
					.where(and(eq(pollVote.userId, viewerId), inArray(pollVote.postId, postIds)))
			: []
	]);
	const votedOption = new Map(votes.map((v) => [v.postId, v.optionId]));

	const polls = new Map<string, PollData>();
	for (const { option, closesAt } of options) {
		let data = polls.get(option.postId);
		if (!data) {
			data = {
				options: [],
				totalVotes: 0,
				closesAt: closesAt.toISOString(),
				closed: closesAt <= now,
				votedOptionId: votedOption.get(option.postId) ?? null
			};
			polls.set(option.postId, data);
		}
		data.options.push({ id: option.id, label: option.label, votes: option.votesCount });
		data.totalVotes += option.votesCount;
	}
	return polls;
}

/**
 * Records the user's vote for `optionId` in `postId`'s poll and returns the poll. A vote cannot be
 * changed: 409 once the user has voted or the poll has closed.
 */
export async function votePoll(
	db: Database,
	userId: string,
	postId: string,
	optionId: string,
	now = new Date()
): Promise<PollData> {
	const [option] = await db
		.select({ closesAt: poll.closesAt })
		.from(pollOption)
		.innerJoin(poll, eq(poll.postId, pollOption.postId))
		.where(and(eq(pollOption.id, optionId), eq(pollOption.postId, postId)))
		.limit(1);
	if (!option) throw new ApiError(404, 'not_found', 'Poll option not found');
	if (option.closesAt <= now) throw new ApiError(409, 'poll_closed', 'This poll has closed');

	// One batch (one transaction): `changes()` is the number of rows the insert just before added,
	// 0 when the user had already voted, so only a first vote is counted.
	const [inserted] = await db.batch([
		db
			.insert(pollVote)
			.values({ postId, userId, optionId })
			.onConflictDoNothing()
			.returning({ optionId: pollVote.optionId }),
		db
			.update(pollOption)
			.set({ votesCount: sql`${pollOption.votesCount} + 1` })
			.where(and(eq(pollOption.id, optionId), sql`changes() > 0`))
	]);
	if (inserted.length === 0) {
		throw new ApiError(409, 'already_voted', 'You already voted in this poll');
	}

	const voted = (await loadPolls(db, userId, [postId], now)).get(postId);
	if (!voted) throw new ApiError(404, 'not_found', 'Poll not found');
	return voted;
}

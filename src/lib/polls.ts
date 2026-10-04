import { m } from '$lib/i18n';
import { formatCount } from '$lib/utils/format';

/** A poll offers 2 to 4 choices of up to 80 characters each. */
export const MIN_POLL_OPTIONS = 2;
export const MAX_POLL_OPTIONS = 4;
export const MAX_POLL_OPTION_LENGTH = 80;

/** How long a poll stays open: 5 minutes to 7 days. */
export const MIN_POLL_DURATION_MINUTES = 5;
export const MAX_POLL_DURATION_MINUTES = 7 * 24 * 60;

/** The durations the composer offers. */
export const POLL_DURATIONS: { minutes: number; label: string }[] = [
	{ minutes: 5, label: m.duration_minutes(5) },
	{ minutes: 60, label: m.duration_hours(1) },
	{ minutes: 6 * 60, label: m.duration_hours(6) },
	{ minutes: 24 * 60, label: m.duration_days(1) },
	{ minutes: 3 * 24 * 60, label: m.duration_days(3) },
	{ minutes: 7 * 24 * 60, label: m.duration_days(7) }
];
export const DEFAULT_POLL_DURATION_MINUTES = 24 * 60;

/** The poll a text post is created with; it opens when the post is published. */
export interface PollInput {
	options: string[];
	durationMinutes: number;
}

/** A post's poll as the viewer sees it; `closesAt` is an ISO string. */
export interface PollData {
	options: { id: string; label: string; votes: number }[];
	totalVotes: number;
	closesAt: string;
	closed: boolean;
	/** The option the viewer voted for, or null. */
	votedOptionId: string | null;
}

/** The line under a poll: "12 votes · 3h left", "1 vote · Final results". */
export function pollSummary(poll: PollData, now = Date.now()): string {
	const votes = m.poll_vote_count(poll.totalVotes, formatCount(poll.totalVotes));
	const leftMin = Math.ceil((new Date(poll.closesAt).getTime() - now) / 60_000);
	if (poll.closed || leftMin <= 0) return m.poll_summary_final(votes);
	const left =
		leftMin < 60
			? m.poll_left_minutes(leftMin)
			: leftMin < 24 * 60
				? m.poll_left_hours(Math.floor(leftMin / 60))
				: m.poll_left_days(Math.floor(leftMin / (24 * 60)));
	return m.poll_summary_open(votes, left);
}

import type { PostType } from '$lib/components/feed/PostCard.svelte';
import type { TextBackground } from '$lib/post-backgrounds';
import type { PollInput } from '$lib/polls';

/** Drafts one user may keep at a time. */
export const MAX_DRAFTS_PER_USER = 50;

/** How far ahead a draft may be scheduled: at least 5 minutes, at most 30 days. */
export const MIN_SCHEDULE_LEAD_MS = 5 * 60 * 1000;
export const MAX_SCHEDULE_LEAD_MS = 30 * 24 * 60 * 60 * 1000;

/** The post a draft holds: the body `POST /api/posts` takes, as validated on save. */
export interface DraftPayload {
	content: string;
	title: string | null;
	mediaUrls: { url: string; type: 'image' | 'video'; alt?: string }[];
	aspectRatio: '1:1' | '4:5' | '16:9';
	location: string | null;
	cameraMeta: string | null;
	postType: PostType;
	background: TextBackground | null;
	/** Text posts; missing from drafts saved before polls existed. */
	poll?: PollInput | null;
	/** Without the leading '#'. */
	tags: string[];
}

/** A draft as `/api/drafts` returns it; times are ISO strings. */
export interface DraftData {
	id: string;
	payload: DraftPayload;
	publishAt: string | null;
	lastError: string | null;
	createdAt: string;
	updatedAt: string;
}

const publishAtFormat = new Intl.DateTimeFormat(undefined, {
	dateStyle: 'medium',
	timeStyle: 'short'
});

/** A publish time in the viewer's locale and time zone: "Oct 3, 2026, 4:05 PM". */
export function formatPublishAt(iso: string): string {
	return publishAtFormat.format(new Date(iso));
}

/** `date` as an `<input type="datetime-local">` value, in the viewer's time zone. */
export function toLocalInputValue(date: Date): string {
	return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

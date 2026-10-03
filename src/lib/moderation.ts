/** What a moderator can do with a reported target, from the queue. */
export const RESOLVE_ACTIONS = ['dismiss', 'remove_content', 'suspend_user'] as const;
export type ResolveAction = (typeof RESOLVE_ACTIONS)[number];

export const MAX_SUSPENSION_DAYS = 365;

/** Max length of a moderator's note on an action. */
export const MODERATION_NOTE_MAX = 500;

/** Suspension lengths offered in the queue; null suspends until an admin lifts it. */
export const SUSPENSION_OPTIONS = [
	{ days: 1, label: '1 day' },
	{ days: 7, label: '7 days' },
	{ days: 30, label: '30 days' },
	{ days: null, label: 'Until lifted' }
] as const;

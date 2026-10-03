import { m } from '$lib/i18n';

/** What a moderator can do with a reported target, from the queue. */
export const RESOLVE_ACTIONS = ['dismiss', 'remove_content', 'suspend_user'] as const;
export type ResolveAction = (typeof RESOLVE_ACTIONS)[number];

export const MAX_SUSPENSION_DAYS = 365;

/** Max length of a moderator's note on an action. */
export const MODERATION_NOTE_MAX = 500;

/** Suspension lengths offered in the queue; null suspends until an admin lifts it. */
export const SUSPENSION_OPTIONS = [
	{ days: 1, label: m.duration_days(1) },
	{ days: 7, label: m.duration_days(7) },
	{ days: 30, label: m.duration_days(30) },
	{ days: null, label: m.moderation_suspend_until_lifted() }
] as const;

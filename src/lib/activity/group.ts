import { m } from '$lib/i18n';
import type { ActivityItem, ActivityType } from './types';

/** Notifications shown as one row: "Bob and 2 others liked your post". */
export interface ActivityGroup {
	/** Stable key: the newest item's id. */
	key: string;
	type: ActivityType;
	/** Newest first, one entry per person. */
	actors: ActivityItem['actor'][];
	/** Newest item's time (epoch ms). */
	createdAt: number;
	unread: boolean;
	post: ActivityItem['post'];
	comment: ActivityItem['comment'];
}

/** What a notification groups by; comments, replies and quotes are never grouped. */
function groupKey(item: ActivityItem): string | null {
	switch (item.type) {
		case 'like':
			return `like:${item.post?.id}`;
		case 'repost':
			return `repost:${item.post?.id}`;
		case 'reaction':
			return `reaction:${item.comment?.id}`;
		case 'follow':
			return 'follow';
		default:
			return null;
	}
}

/**
 * Groups likes and reposts of the same post, reactions on the same comment, and follows. Input
 * and output are newest first; a group sits where its newest item was and is unread if any of its
 * items is.
 */
export function groupActivity(items: ActivityItem[]): ActivityGroup[] {
	const groups: ActivityGroup[] = [];
	const byKey = new Map<string, ActivityGroup>();
	for (const item of items) {
		const key = groupKey(item);
		const existing = key ? byKey.get(key) : undefined;
		if (existing) {
			if (!existing.actors.some((a) => a.id === item.actor.id)) existing.actors.push(item.actor);
			existing.unread ||= item.unread;
			continue;
		}
		const group: ActivityGroup = {
			key: item.id,
			type: item.type,
			actors: [item.actor],
			createdAt: item.createdAt,
			unread: item.unread,
			post: item.post,
			comment: item.comment
		};
		groups.push(group);
		if (key) byKey.set(key, group);
	}
	return groups;
}

/** "Bob", "Bob and Carol", "Bob and 3 others". */
export function actorNames(actors: ActivityGroup['actors']): string {
	const [first, second] = actors;
	if (actors.length === 1) return first.name;
	if (actors.length === 2) return m.activity_two_actors(first.name, second.name);
	return m.activity_actor_and_others(first.name, actors.length - 1);
}

/** The sentence after the names, for a group or a single notification. */
export function activityVerb({ type }: Pick<ActivityGroup, 'type'>): string {
	switch (type) {
		case 'like':
			return m.activity_verb_like();
		case 'comment':
			return m.activity_verb_comment();
		case 'reply':
			return m.activity_verb_reply();
		case 'reaction':
			return m.activity_verb_reaction();
		case 'follow':
			return m.activity_verb_follow();
		case 'mention':
			return m.activity_verb_mention();
		case 'story_reaction':
			return m.activity_verb_story_reaction();
		case 'follow_request':
			return m.activity_verb_follow_request();
		case 'follow_accepted':
			return m.activity_verb_follow_accepted();
		case 'repost':
			return m.activity_verb_repost();
		case 'quote':
			return m.activity_verb_quote();
	}
}

/** What each type of notification is about, as named in notification settings. */
export const activityTypeLabels: Record<ActivityType, string> = {
	like: m.activity_type_like(),
	comment: m.activity_type_comment(),
	reply: m.activity_type_reply(),
	reaction: m.activity_type_reaction(),
	follow: m.activity_type_follow(),
	mention: m.activity_type_mention(),
	story_reaction: m.activity_type_story_reaction(),
	follow_request: m.activity_type_follow_request(),
	follow_accepted: m.activity_type_follow_accepted(),
	repost: m.activity_type_repost(),
	quote: m.activity_type_quote()
};

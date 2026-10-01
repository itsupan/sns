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

/** What a notification groups by; comments and replies are never grouped. */
function groupKey(item: ActivityItem): string | null {
	switch (item.type) {
		case 'like':
			return `like:${item.post?.id}`;
		case 'reaction':
			return `reaction:${item.comment?.id}`;
		case 'follow':
			return 'follow';
		default:
			return null;
	}
}

/**
 * Groups likes on the same post, reactions on the same comment, and follows. Input and output are
 * newest first; a group sits where its newest item was and is unread if any of its items is.
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
	if (actors.length === 2) return `${first.name} and ${second.name}`;
	return `${first.name} and ${actors.length - 1} others`;
}

/** The sentence after the names. */
export function activityVerb(group: ActivityGroup): string {
	switch (group.type) {
		case 'like':
			return 'liked your post';
		case 'comment':
			return 'commented on your post';
		case 'reply':
			return 'replied to your comment';
		case 'reaction':
			return 'reacted to your comment';
		case 'follow':
			return 'started following you';
		case 'mention':
			return 'tagged you in a post';
		case 'story_reaction':
			return 'reacted to your story';
	}
}

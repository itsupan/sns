export type ActivityType =
	'like' | 'comment' | 'reply' | 'reaction' | 'follow' | 'mention' | 'story_reaction';

/** One notification as the Activity API returns it. */
export interface ActivityItem {
	id: string;
	type: ActivityType;
	/** Epoch milliseconds. */
	createdAt: number;
	unread: boolean;
	actor: {
		id: string;
		name: string;
		/** Display handle, e.g. `@bob`. */
		handle: string;
		/** Segment for `/profile/[id]`: the handle when set, else the user id. */
		slug: string;
		image: string | null;
	};
	post: { id: string; thumbnail: string | null } | null;
	comment: { id: string; content: string } | null;
}

export interface ActivityPage {
	items: ActivityItem[];
	nextCursor: string | null;
}

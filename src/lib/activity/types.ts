export type ActivityType =
	| 'like'
	| 'comment'
	| 'reply'
	| 'reaction'
	| 'follow'
	| 'mention'
	| 'story_reaction'
	| 'follow_request'
	| 'follow_accepted';

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

/** Someone waiting for the user to approve their request to follow. */
export interface FollowRequestUser {
	id: string;
	name: string;
	handle: string | null;
	image: string | null;
	/** When the request was made (ms). */
	requestedAt: number;
}

export interface FollowRequestPage {
	users: FollowRequestUser[];
	nextCursor: string | null;
}

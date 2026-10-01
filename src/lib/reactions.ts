/** Reactions a user can leave on a comment. Shared by the API (validation) and the UI (picker). */
export const COMMENT_REACTIONS = ['like', 'love', 'haha', 'wow', 'sad', 'fire'] as const;

export type CommentReaction = (typeof COMMENT_REACTIONS)[number];

export const REACTION_EMOJI: Record<CommentReaction, string> = {
	like: '👍',
	love: '❤️',
	haha: '😂',
	wow: '😮',
	sad: '😢',
	fire: '🔥'
};

export const REACTION_LABEL: Record<CommentReaction, string> = {
	like: 'Like',
	love: 'Love',
	haha: 'Haha',
	wow: 'Wow',
	sad: 'Sad',
	fire: 'Fire'
};

export function isCommentReaction(value: unknown): value is CommentReaction {
	return (COMMENT_REACTIONS as readonly unknown[]).includes(value);
}

/** Per-comment reaction state: count per type (only types with a count) and the viewer's own. */
export interface ReactionSummary {
	counts: Partial<Record<CommentReaction, number>>;
	mine: CommentReaction[];
}

export const emptyReactionSummary = (): ReactionSummary => ({ counts: {}, mine: [] });

/** Quick reactions a viewer can send on a story. Shared by the API (validation) and the viewer. */
export const STORY_REACTIONS = ['❤️', '😂', '😮', '😢', '👏', '🔥'] as const;

export type StoryReaction = (typeof STORY_REACTIONS)[number];

export function isStoryReaction(value: unknown): value is StoryReaction {
	return (STORY_REACTIONS as readonly unknown[]).includes(value);
}

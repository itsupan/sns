import * as v from 'valibot';
import { MAX_HIGHLIGHT_TITLE } from '$lib/highlights';

/** A highlight's name, trimmed: 1 to `MAX_HIGHLIGHT_TITLE` characters. */
export const HighlightTitle = v.pipe(
	v.string('Title is required'),
	v.trim(),
	v.minLength(1, 'Title is required'),
	v.maxLength(MAX_HIGHLIGHT_TITLE, `Title cannot exceed ${MAX_HIGHLIGHT_TITLE} characters`)
);

export const StoryId = v.pipe(
	v.string('Story ID is required'),
	v.minLength(1, 'Story ID is required')
);

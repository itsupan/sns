/**
 * Product limits for a single post, shared by the composer and POST /api/posts.
 * They also keep each insert under D1's 100 bound-variables-per-statement limit
 * (a media row binds 5 values; tag statements bind about 3 per tag).
 */
export const MAX_MEDIA_PER_POST = 10;
export const MAX_TAGS_PER_POST = 20;
export const MAX_TAG_LENGTH = 50;

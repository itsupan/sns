/**
 * Product limits for a single post, shared by the composer and POST /api/posts.
 * They also keep each insert under D1's 100 bound-variables-per-statement limit
 * (a media row binds 5 values; tag statements bind about 3 per tag).
 */
export const MAX_MEDIA_PER_POST = 10;
export const MAX_TAGS_PER_POST = 20;
export const MAX_TAG_LENGTH = 50;

/** Text caps enforced by POST and PATCH /api/posts (the composer's own cap is lower). */
export const MAX_POST_CONTENT_LENGTH = 5000;
export const MAX_POST_TITLE_LENGTH = 200;
export const MAX_POST_LOCATION_LENGTH = 100;
export const MAX_CAMERA_META_LENGTH = 100;

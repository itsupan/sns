import { isNull } from 'drizzle-orm';
import { post } from './schema';

/** Every read or write of a post must exclude soft-deleted rows (see `post.deletedAt`). */
export const notDeleted = isNull(post.deletedAt);

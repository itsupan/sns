import * as v from 'valibot';

/*
 * Operational settings that differ per environment. Values come from wrangler `vars`
 * (wrangler.jsonc, or `.dev.vars` locally) and fall back to the defaults below.
 * Product rules tied to the data model (e.g. max comment length) stay in their schemas.
 */

export interface RateLimitRule {
	/** Max requests per window. */
	limit: number;
	/** Window length in seconds. */
	windowSec: number;
}

export type RateLimitName =
	| 'createPost'
	| 'createStory'
	| 'comment'
	| 'reaction'
	| 'storyReaction'
	| 'search'
	| 'chatStart'
	| 'chatMessage'
	| 'chatConnect'
	| 'like'
	| 'save'
	| 'share'
	| 'follow'
	| 'uploadPresign'
	| 'mediaRefresh'
	| 'accountExport'
	| 'report'
	| 'accountDelete';

export interface PageSize {
	defaultPageSize: number;
	maxPageSize: number;
}

export interface AppConfig {
	rateLimits: Record<RateLimitName, RateLimitRule>;
	upload: { maxBytes: number; allowedMimeTypes: ReadonlySet<string> };
	feed: PageSize;
	/** Top-level comments and replies lists. */
	comments: PageSize;
	/** Results per section (users, posts) of GET /api/search. */
	search: PageSize;
	/** The viewer's saved posts list. */
	saved: PageSize;
	/** The Activity (notifications) list. */
	activity: PageSize;
	/** Explore and tag-page grids. */
	explore: PageSize;
	/** Chat history pages and the conversations inbox. */
	chat: { messages: PageSize; inbox: PageSize };
	/** Lifetime of presigned media GET URLs; SigV4 caps this at 7 days. */
	mediaUrlTtlSec: number;
	/** Normalized emails (see `normalizeEmail`) that may not create an account. */
	auth: { blockedSignupEmails: ReadonlySet<string> };
}

const MAX_SIGV4_TTL_SEC = 7 * 24 * 3600;

export const DEFAULT_CONFIG: AppConfig = {
	rateLimits: {
		createPost: { limit: 10, windowSec: 60 },
		createStory: { limit: 10, windowSec: 60 },
		comment: { limit: 20, windowSec: 60 },
		reaction: { limit: 60, windowSec: 60 },
		storyReaction: { limit: 60, windowSec: 60 },
		search: { limit: 60, windowSec: 60 },
		chatStart: { limit: 10, windowSec: 60 },
		chatMessage: { limit: 30, windowSec: 60 },
		chatConnect: { limit: 30, windowSec: 60 },
		like: { limit: 60, windowSec: 60 },
		save: { limit: 60, windowSec: 60 },
		share: { limit: 30, windowSec: 60 },
		follow: { limit: 30, windowSec: 60 },
		uploadPresign: { limit: 20, windowSec: 60 },
		mediaRefresh: { limit: 60, windowSec: 60 },
		accountExport: { limit: 5, windowSec: 3600 },
		report: { limit: 10, windowSec: 3600 },
		accountDelete: { limit: 5, windowSec: 3600 }
	},
	upload: {
		maxBytes: 50 * 1024 * 1024,
		allowedMimeTypes: new Set([
			'image/jpeg',
			'image/png',
			'image/webp',
			'image/gif',
			'image/avif',
			'video/mp4',
			'video/webm',
			'video/quicktime'
		])
	},
	feed: { defaultPageSize: 10, maxPageSize: 50 },
	comments: { defaultPageSize: 20, maxPageSize: 50 },
	search: { defaultPageSize: 5, maxPageSize: 20 },
	saved: { defaultPageSize: 12, maxPageSize: 50 },
	activity: { defaultPageSize: 20, maxPageSize: 50 },
	explore: { defaultPageSize: 18, maxPageSize: 36 },
	chat: {
		messages: { defaultPageSize: 30, maxPageSize: 100 },
		inbox: { defaultPageSize: 20, maxPageSize: 50 }
	},
	mediaUrlTtlSec: MAX_SIGV4_TTL_SEC,
	auth: { blockedSignupEmails: new Set() }
};

/** Env var name for each rate limit. Value format: `<limit>/<windowSeconds>`, e.g. `10/60`. */
export const RATE_LIMIT_VARS: Record<RateLimitName, string> = {
	createPost: 'RATE_LIMIT_CREATE_POST',
	createStory: 'RATE_LIMIT_CREATE_STORY',
	comment: 'RATE_LIMIT_COMMENT',
	reaction: 'RATE_LIMIT_REACTION',
	storyReaction: 'RATE_LIMIT_STORY_REACTION',
	search: 'RATE_LIMIT_SEARCH',
	chatStart: 'RATE_LIMIT_CHAT_START',
	chatMessage: 'RATE_LIMIT_CHAT_MESSAGE',
	chatConnect: 'RATE_LIMIT_CHAT_CONNECT',
	like: 'RATE_LIMIT_LIKE',
	save: 'RATE_LIMIT_SAVE',
	share: 'RATE_LIMIT_SHARE',
	follow: 'RATE_LIMIT_FOLLOW',
	uploadPresign: 'RATE_LIMIT_UPLOAD_PRESIGN',
	mediaRefresh: 'RATE_LIMIT_MEDIA_REFRESH',
	accountExport: 'RATE_LIMIT_ACCOUNT_EXPORT',
	report: 'RATE_LIMIT_REPORT',
	accountDelete: 'RATE_LIMIT_ACCOUNT_DELETE'
};

const PositiveInt = v.pipe(v.string(), v.trim(), v.regex(/^\d+$/), v.toNumber(), v.minValue(1));

const RateLimitVar = v.pipe(
	v.string(),
	v.trim(),
	v.regex(/^\d+\/\d+$/),
	v.transform((value): RateLimitRule => {
		const [limit, windowSec] = value.split('/').map(Number);
		return { limit, windowSec };
	}),
	v.check((rule) => rule.limit >= 1 && rule.windowSec >= 1)
);

const MimeList = v.pipe(
	v.string(),
	v.transform(
		(value) =>
			new Set(
				value
					.split(',')
					.map((m) => m.trim().toLowerCase())
					.filter(Boolean)
			)
	),
	v.check((set) => set.size > 0)
);

/**
 * Canonical form used to compare emails: trimmed and lowercased. Gmail ignores dots and
 * `+suffix` in the local part, so those variants map to the same address.
 */
export function normalizeEmail(email: string): string {
	const trimmed = email.trim().toLowerCase();
	const at = trimmed.lastIndexOf('@');
	if (at < 0) return trimmed;
	let local = trimmed.slice(0, at);
	let domain = trimmed.slice(at + 1);
	if (domain === 'gmail.com' || domain === 'googlemail.com') {
		local = local.split('+')[0].replaceAll('.', '');
		domain = 'gmail.com';
	}
	return `${local}@${domain}`;
}

const EmailList = v.pipe(
	v.string(),
	v.transform(
		(value) =>
			new Set(
				value
					.split(',')
					.map((e) => e.trim())
					.filter(Boolean)
					.map(normalizeEmail)
			)
	),
	v.check((set) => [...set].every((e) => /^[^@\s]+@[^@\s]+$/.test(e)))
);

type Vars = Record<string, unknown>;

/** Reads `name` from env with `schema`; a missing value uses `fallback`, a bad one warns and uses it. */
function read<T>(vars: Vars, name: string, schema: v.GenericSchema<string, T>, fallback: T): T {
	const raw = vars[name];
	if (raw === undefined || raw === '') return fallback;
	const result = v.safeParse(schema, String(raw));
	if (result.success) return result.output;
	console.warn(`[config] Ignoring invalid ${name}=${JSON.stringify(raw)}; using default.`);
	return fallback;
}

export function loadConfig(env: object | undefined): AppConfig {
	const vars = (env ?? {}) as Vars;
	const d = DEFAULT_CONFIG;

	const rateLimits = Object.fromEntries(
		(Object.keys(RATE_LIMIT_VARS) as RateLimitName[]).map((name) => [
			name,
			read(vars, RATE_LIMIT_VARS[name], RateLimitVar, d.rateLimits[name])
		])
	) as AppConfig['rateLimits'];

	/** `<PREFIX>_PAGE_SIZE` clamped to `<PREFIX>_MAX_PAGE_SIZE`. */
	const pageSize = (prefix: string, fallback: PageSize): PageSize => {
		const maxPageSize = read(vars, `${prefix}_MAX_PAGE_SIZE`, PositiveInt, fallback.maxPageSize);
		const defaultPageSize = Math.min(
			read(vars, `${prefix}_PAGE_SIZE`, PositiveInt, fallback.defaultPageSize),
			maxPageSize
		);
		return { defaultPageSize, maxPageSize };
	};

	return {
		rateLimits,
		upload: {
			maxBytes: read(vars, 'UPLOAD_MAX_BYTES', PositiveInt, d.upload.maxBytes),
			allowedMimeTypes: read(vars, 'UPLOAD_ALLOWED_MIME_TYPES', MimeList, d.upload.allowedMimeTypes)
		},
		feed: pageSize('FEED', d.feed),
		comments: pageSize('COMMENTS', d.comments),
		search: pageSize('SEARCH', d.search),
		saved: pageSize('SAVED', d.saved),
		activity: pageSize('ACTIVITY', d.activity),
		explore: pageSize('EXPLORE', d.explore),
		chat: {
			messages: pageSize('CHAT', d.chat.messages),
			inbox: pageSize('INBOX', d.chat.inbox)
		},
		mediaUrlTtlSec: Math.min(
			read(vars, 'MEDIA_URL_TTL_SECONDS', PositiveInt, d.mediaUrlTtlSec),
			MAX_SIGV4_TTL_SEC
		),
		auth: {
			blockedSignupEmails: read(
				vars,
				'SIGNUP_BLOCKED_EMAILS',
				EmailList,
				d.auth.blockedSignupEmails
			)
		}
	};
}

const cache = new WeakMap<object, AppConfig>();

/** Config for this Worker's env, parsed once per env object. */
export function getConfig(env: object | undefined): AppConfig {
	if (!env) return DEFAULT_CONFIG;
	let config = cache.get(env);
	if (!config) {
		config = loadConfig(env);
		cache.set(env, config);
	}
	return config;
}

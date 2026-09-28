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

export type RateLimitName = 'createPost' | 'comment' | 'like' | 'follow' | 'uploadPresign';

export interface AppConfig {
	rateLimits: Record<RateLimitName, RateLimitRule>;
	upload: { maxBytes: number; allowedMimeTypes: ReadonlySet<string> };
	feed: { defaultPageSize: number; maxPageSize: number };
	/** Lifetime of presigned media GET URLs; SigV4 caps this at 7 days. */
	mediaUrlTtlSec: number;
	/** Normalized emails (see `normalizeEmail`) that may not create an account. */
	auth: { blockedSignupEmails: ReadonlySet<string> };
}

const MAX_SIGV4_TTL_SEC = 7 * 24 * 3600;

export const DEFAULT_CONFIG: AppConfig = {
	rateLimits: {
		createPost: { limit: 10, windowSec: 60 },
		comment: { limit: 20, windowSec: 60 },
		like: { limit: 60, windowSec: 60 },
		follow: { limit: 30, windowSec: 60 },
		uploadPresign: { limit: 20, windowSec: 60 }
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
	mediaUrlTtlSec: MAX_SIGV4_TTL_SEC,
	auth: { blockedSignupEmails: new Set() }
};

/** Env var name for each rate limit. Value format: `<limit>/<windowSeconds>`, e.g. `10/60`. */
export const RATE_LIMIT_VARS: Record<RateLimitName, string> = {
	createPost: 'RATE_LIMIT_CREATE_POST',
	comment: 'RATE_LIMIT_COMMENT',
	like: 'RATE_LIMIT_LIKE',
	follow: 'RATE_LIMIT_FOLLOW',
	uploadPresign: 'RATE_LIMIT_UPLOAD_PRESIGN'
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

	const maxPageSize = read(vars, 'FEED_MAX_PAGE_SIZE', PositiveInt, d.feed.maxPageSize);
	const defaultPageSize = Math.min(
		read(vars, 'FEED_PAGE_SIZE', PositiveInt, d.feed.defaultPageSize),
		maxPageSize
	);

	return {
		rateLimits,
		upload: {
			maxBytes: read(vars, 'UPLOAD_MAX_BYTES', PositiveInt, d.upload.maxBytes),
			allowedMimeTypes: read(vars, 'UPLOAD_ALLOWED_MIME_TYPES', MimeList, d.upload.allowedMimeTypes)
		},
		feed: { defaultPageSize, maxPageSize },
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

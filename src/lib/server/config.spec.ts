import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG, getConfig, loadConfig, normalizeEmail } from './config';

afterEach(() => vi.restoreAllMocks());

describe('loadConfig', () => {
	it('uses defaults when nothing is set', () => {
		expect(loadConfig({})).toEqual(DEFAULT_CONFIG);
		expect(loadConfig(undefined)).toEqual(DEFAULT_CONFIG);
	});

	it('reads overrides from env vars', () => {
		const config = loadConfig({
			RATE_LIMIT_LIKE: '5/30',
			UPLOAD_MAX_BYTES: '1048576',
			UPLOAD_ALLOWED_MIME_TYPES: ' image/png , IMAGE/JPEG ',
			FEED_PAGE_SIZE: '10',
			FEED_MAX_PAGE_SIZE: '25',
			MEDIA_URL_TTL_SECONDS: '3600'
		});
		expect(config.rateLimits.like).toEqual({ limit: 5, windowSec: 30 });
		expect(loadConfig({ RATE_LIMIT_REACTION: '3/10' }).rateLimits.reaction).toEqual({
			limit: 3,
			windowSec: 10
		});
		expect(config.rateLimits.comment).toEqual(DEFAULT_CONFIG.rateLimits.comment);
		expect(config.upload.maxBytes).toBe(1048576);
		expect([...config.upload.allowedMimeTypes]).toEqual(['image/png', 'image/jpeg']);
		expect(config.feed).toEqual({ defaultPageSize: 10, maxPageSize: 25 });
		expect(config.mediaUrlTtlSec).toBe(3600);
	});

	it('warns and falls back on invalid values', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const config = loadConfig({
			RATE_LIMIT_LIKE: 'lots',
			RATE_LIMIT_COMMENT: '0/60',
			UPLOAD_MAX_BYTES: '-5',
			UPLOAD_ALLOWED_MIME_TYPES: ' , '
		});
		expect(config.rateLimits.like).toEqual(DEFAULT_CONFIG.rateLimits.like);
		expect(config.rateLimits.comment).toEqual(DEFAULT_CONFIG.rateLimits.comment);
		expect(config.upload).toEqual(DEFAULT_CONFIG.upload);
		expect(warn).toHaveBeenCalledTimes(4);
	});

	it('clamps page size and media TTL to their maximums', () => {
		const config = loadConfig({
			FEED_PAGE_SIZE: '100',
			FEED_MAX_PAGE_SIZE: '30',
			MEDIA_URL_TTL_SECONDS: '99999999'
		});
		expect(config.feed.defaultPageSize).toBe(30);
		expect(loadConfig({ COMMENTS_PAGE_SIZE: '80', COMMENTS_MAX_PAGE_SIZE: '40' }).comments).toEqual(
			{ defaultPageSize: 40, maxPageSize: 40 }
		);
		expect(loadConfig({ CHAT_PAGE_SIZE: '500', INBOX_MAX_PAGE_SIZE: '10' }).chat).toEqual({
			messages: { defaultPageSize: 100, maxPageSize: 100 },
			inbox: { defaultPageSize: 10, maxPageSize: 10 }
		});
		expect(loadConfig({ SEARCH_PAGE_SIZE: '8' }).search).toEqual({
			defaultPageSize: 8,
			maxPageSize: 20
		});
		expect(config.mediaUrlTtlSec).toBe(7 * 24 * 3600);
	});
});

describe('getConfig', () => {
	it('parses once per env object', () => {
		const env = { FEED_PAGE_SIZE: '7' };
		expect(getConfig(env)).toBe(getConfig(env));
		expect(getConfig(env).feed.defaultPageSize).toBe(7);
	});
});

describe('SIGNUP_BLOCKED_EMAILS', () => {
	it('normalizes emails, including Gmail dot and +suffix variants', () => {
		expect(normalizeEmail('  Foo.Bar+spam@GMail.com ')).toBe('foobar@gmail.com');
		expect(normalizeEmail('foo.bar@googlemail.com')).toBe('foobar@gmail.com');
		// Other providers treat dots and + as significant.
		expect(normalizeEmail('Foo.Bar+x@Example.com')).toBe('foo.bar+x@example.com');
	});

	it('parses a comma-separated list and ignores invalid values', () => {
		const config = loadConfig({ SIGNUP_BLOCKED_EMAILS: ' A.b@gmail.com , x@y.dev ,' });
		expect([...config.auth.blockedSignupEmails]).toEqual(['ab@gmail.com', 'x@y.dev']);

		vi.spyOn(console, 'warn').mockImplementation(() => {});
		expect(
			loadConfig({ SIGNUP_BLOCKED_EMAILS: 'not-an-email' }).auth.blockedSignupEmails.size
		).toBe(0);
	});
});

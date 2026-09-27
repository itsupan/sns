import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG, getConfig, loadConfig } from './config';

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

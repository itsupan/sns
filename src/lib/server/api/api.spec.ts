import { describe, expect, it } from 'vitest';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';
import { ApiError, apiError, parseBody, parseQuery, requireUser, withApi } from '.';

const jsonRequest = (body: string) =>
	new Request('http://localhost/api/test', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body
	});

async function catchApiError(promise: Promise<unknown>): Promise<ApiError> {
	try {
		await promise;
	} catch (err) {
		if (err instanceof ApiError) return err;
		throw err;
	}
	throw new Error('expected ApiError');
}

describe('apiError', () => {
	it('builds the standard error body', async () => {
		const res = apiError(404, 'not_found', 'Post not found');
		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({ error: { code: 'not_found', message: 'Post not found' } });
	});

	it('includes field errors when given', async () => {
		const res = apiError(400, 'validation_failed', 'Invalid', { content: 'Required' });
		expect(await res.json()).toEqual({
			error: { code: 'validation_failed', message: 'Invalid', fields: { content: 'Required' } }
		});
	});
});

describe('requireUser', () => {
	it('returns the signed-in user', () => {
		const user = { id: 'user-1' };
		expect(requireUser({ user } as unknown as App.Locals)).toBe(user);
	});

	it('throws a 401 ApiError when signed out', () => {
		expect(() => requireUser({ user: null } as unknown as App.Locals)).toThrow(ApiError);
		try {
			requireUser({ user: null } as unknown as App.Locals);
		} catch (err) {
			expect((err as ApiError).status).toBe(401);
			expect((err as ApiError).code).toBe('unauthorized');
		}
	});
});

describe('parseBody', () => {
	const schema = v.object({
		content: v.pipe(v.string(), v.minLength(1, 'Content is required')),
		title: v.optional(v.string())
	});

	it('returns typed output for a valid body', async () => {
		await expect(parseBody(jsonRequest('{"content":"hi"}'), schema)).resolves.toEqual({
			content: 'hi'
		});
	});

	it('rejects invalid JSON with invalid_json', async () => {
		const err = await catchApiError(parseBody(jsonRequest('{nope'), schema));
		expect(err.status).toBe(400);
		expect(err.code).toBe('invalid_json');
	});

	it('rejects invalid fields with per-field messages', async () => {
		const err = await catchApiError(parseBody(jsonRequest('{"content":""}'), schema));
		expect(err.status).toBe(400);
		expect(err.code).toBe('validation_failed');
		expect(err.fields).toEqual({ content: 'Content is required' });
	});
});

describe('parseQuery', () => {
	const schema = v.object({
		limit: v.optional(v.pipe(v.string(), v.toNumber(), v.integer(), v.maxValue(50)), '20')
	});

	it('coerces and defaults query params', async () => {
		await expect(parseQuery(new URL('http://x/?limit=10'), schema)).resolves.toEqual({ limit: 10 });
		await expect(parseQuery(new URL('http://x/'), schema)).resolves.toEqual({ limit: 20 });
	});

	it('rejects out-of-range values', async () => {
		const err = await catchApiError(parseQuery(new URL('http://x/?limit=500'), schema));
		expect(err.fields).toHaveProperty('limit');
	});
});

describe('withApi', () => {
	it('passes through successful responses', async () => {
		const handler = withApi(() => new Response('ok'));
		expect(await (await handler({})).text()).toBe('ok');
	});

	it('converts a thrown ApiError into its response', async () => {
		const handler = withApi(() => {
			throw new ApiError(403, 'forbidden', 'Not your post');
		});
		const res = await handler({});
		expect(res.status).toBe(403);
		expect(await res.json()).toEqual({ error: { code: 'forbidden', message: 'Not your post' } });
	});

	it('rethrows non-ApiError errors', async () => {
		const handler = withApi(() => {
			error(500, 'boom');
		});
		await expect(handler({})).rejects.toMatchObject({ status: 500 });
	});
});

import { describe, expect, it } from 'vitest';
import { ApiError } from './errors';
import { parsePageQuery } from './pagination';

const SIZE = { defaultPageSize: 10, maxPageSize: 25 };
const parse = (search: string) => parsePageQuery(new URL(`http://x/${search}`), SIZE);

async function rejection(search: string): Promise<ApiError> {
	const err = await parse(search).catch((e: unknown) => e);
	expect(err).toBeInstanceOf(ApiError);
	return err as ApiError;
}

describe('parsePageQuery', () => {
	it('defaults the limit and has no cursor', async () => {
		expect(await parse('')).toEqual({ limit: 10, cursor: null });
	});

	it('accepts limits from 1 up to the maximum', async () => {
		expect((await parse('?limit=1')).limit).toBe(1);
		expect((await parse('?limit=25')).limit).toBe(25);
	});

	it.each(['0', '-1', '26', '2.5', 'abc', ''])('rejects limit=%s with a field error', async (l) => {
		const err = await rejection(`?limit=${l}`);
		expect(err.status).toBe(400);
		expect(err.code).toBe('validation_failed');
		expect(err.fields).toHaveProperty('limit');
	});

	it('decodes a keyset cursor', async () => {
		expect(await parse('?cursor=1700000000000_p-1&limit=5')).toEqual({
			limit: 5,
			cursor: { createdAt: 1700000000000, id: 'p-1' }
		});
	});

	it('treats an empty cursor as the first page', async () => {
		expect((await parse('?cursor=')).cursor).toBeNull();
	});

	it.each(['nope', '123', '_p-1', '12345678901234567_p-1', 'abc_p-1'])(
		'rejects cursor=%s with a field error',
		async (cursor) => {
			const err = await rejection(`?cursor=${cursor}`);
			expect(err.status).toBe(400);
			expect(err.fields).toEqual({ cursor: 'Invalid cursor' });
		}
	);
});

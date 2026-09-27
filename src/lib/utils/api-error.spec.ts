import { describe, expect, it } from 'vitest';
import { readApiError } from './api-error';

describe('readApiError', () => {
	it('reads the standard error shape', () => {
		expect(
			readApiError(
				{ error: { code: 'handle_taken', message: 'Taken', fields: { handle: 'Taken' } } },
				'x'
			)
		).toEqual({ code: 'handle_taken', message: 'Taken', fields: { handle: 'Taken' } });
	});

	it('reads the legacy string shape', () => {
		expect(readApiError({ error: 'Nope' }, 'x')).toEqual({ message: 'Nope' });
	});

	it('falls back for unknown bodies', () => {
		expect(readApiError(null, 'Failed')).toEqual({ message: 'Failed' });
		expect(readApiError({ error: {} }, 'Failed').message).toBe('Failed');
	});
});

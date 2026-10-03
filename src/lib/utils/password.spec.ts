import { describe, expect, it } from 'vitest';
import { newPasswordError } from './password';

describe('newPasswordError', () => {
	it('accepts a long enough password that matches its confirmation', () => {
		expect(newPasswordError('long-enough', 'long-enough')).toBeNull();
	});

	it.each([
		['short', 'short', 'Password must be at least 8 characters long.'],
		['long-enough', '', 'Please confirm your password.'],
		['long-enough', 'long-enougH', 'Passwords do not match.']
	])('rejects %j / %j', (password, confirmation, message) => {
		expect(newPasswordError(password, confirmation)).toBe(message);
	});
});

import { describe, expect, it } from 'vitest';
import { formatCount } from './format';

describe('formatCount', () => {
	it('keeps small numbers as-is', () => {
		expect(formatCount(0)).toBe('0');
		expect(formatCount(842)).toBe('842');
		expect(formatCount(999)).toBe('999');
	});

	it('compacts thousands and millions without rounding up', () => {
		expect(formatCount(1000)).toBe('1K');
		expect(formatCount(1420)).toBe('1.4K');
		expect(formatCount(1999)).toBe('1.9K');
		expect(formatCount(125_400)).toBe('125K');
		expect(formatCount(2_300_000)).toBe('2.3M');
	});
});

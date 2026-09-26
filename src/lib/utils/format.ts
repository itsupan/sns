/** Compact count for social metrics: 842 → "842", 1420 → "1.4K", 2_300_000 → "2.3M". */
export function formatCount(value: number): string {
	if (value < 1000) return String(value);
	const units = [
		{ size: 1_000_000_000, suffix: 'B' },
		{ size: 1_000_000, suffix: 'M' },
		{ size: 1_000, suffix: 'K' }
	];
	for (const { size, suffix } of units) {
		if (value >= size) {
			const scaled = value / size;
			const rounded = scaled >= 100 ? Math.floor(scaled) : Math.floor(scaled * 10) / 10;
			return `${rounded}${suffix}`;
		}
	}
	return String(value);
}

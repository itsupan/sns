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

/** Formats a timestamp into relative time string: "Just now", "5m ago", "2h ago", "3d ago". */
export function formatTimeAgo(date: Date | number | string): string {
	const timestamp =
		typeof date === 'string'
			? new Date(date).getTime()
			: typeof date === 'number'
				? date
				: date.getTime();
	if (isNaN(timestamp)) return '';
	const diffMs = Date.now() - timestamp;
	const diffSec = Math.max(0, Math.floor(diffMs / 1000));

	if (diffSec < 60) return 'Just now';
	const diffMin = Math.floor(diffSec / 60);
	if (diffMin < 60) return `${diffMin}m ago`;
	const diffHr = Math.floor(diffMin / 60);
	if (diffHr < 24) return `${diffHr}h ago`;
	const diffDays = Math.floor(diffHr / 24);
	if (diffDays < 7) return `${diffDays}d ago`;
	const diffWeeks = Math.floor(diffDays / 7);
	if (diffWeeks < 4) return `${diffWeeks}w ago`;
	return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

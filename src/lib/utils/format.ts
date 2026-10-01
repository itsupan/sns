/** Compact count for social metrics: 842 → "842", 1420 → "1.4K", 2_300_000 → "2.3M". */
/** The line under a post: "Liked by you and 3 others", "Liked by Ana", "0 likes". */
export function likesSummary(count: number, liked: boolean, likedBy?: string): string {
	const others = count - 1;
	const rest =
		others === 1 ? ' and 1 other' : others > 1 ? ` and ${formatCount(others)} others` : '';
	if (count > 0 && liked) return `Liked by you${rest}`;
	if (count > 0 && likedBy) return `Liked by ${likedBy}${rest}`;
	return `${formatCount(count)} ${count === 1 ? 'like' : 'likes'}`;
}

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

/** Relative time ("Just now", "5m ago", "3d ago", "2w ago"), then a date: "Mar 3", or "Mar 3, 2025" for another year. */
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
	const then = new Date(timestamp);
	return then.toLocaleDateString(undefined, {
		month: 'short',
		day: 'numeric',
		// A date from another year would otherwise look recent.
		year: then.getFullYear() === new Date().getFullYear() ? undefined : 'numeric'
	});
}

/** `@handle` for display; users without a handle get one derived from their name. */
export function displayHandle(handle: string | null | undefined, name: string): string {
	return handle ? `@${handle.replace(/^@/, '')}` : `@${name.toLowerCase().replace(/\s+/g, '')}`;
}

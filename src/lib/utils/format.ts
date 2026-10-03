import { locale, m } from '$lib/i18n';

const countFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });

/** The line under a post: "Liked by you and 3 others", "Liked by Ana", "0 likes". */
export function likesSummary(count: number, liked: boolean, likedBy?: string): string {
	const others = count - 1;
	if (count > 0 && liked) return m.post_liked_by_you(others, formatCount(others));
	if (count > 0 && likedBy) return m.post_liked_by(likedBy, others, formatCount(others));
	return m.post_like_count(count, formatCount(count));
}

/** Compact count for social metrics: 842 → "842", 1420 → "1.4K", 2_300_000 → "2.3M". */
export function formatCount(value: number): string {
	if (value < 1000) return countFormat.format(value);
	const units = [
		{ size: 1_000_000_000, unit: m.count_billions },
		{ size: 1_000_000, unit: m.count_millions },
		{ size: 1_000, unit: m.count_thousands }
	];
	for (const { size, unit } of units) {
		if (value >= size) {
			const scaled = value / size;
			const rounded = scaled >= 100 ? Math.floor(scaled) : Math.floor(scaled * 10) / 10;
			return unit(countFormat.format(rounded));
		}
	}
	return countFormat.format(value);
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

	if (diffSec < 60) return m.time_just_now();
	const diffMin = Math.floor(diffSec / 60);
	if (diffMin < 60) return m.time_minutes_ago(diffMin);
	const diffHr = Math.floor(diffMin / 60);
	if (diffHr < 24) return m.time_hours_ago(diffHr);
	const diffDays = Math.floor(diffHr / 24);
	if (diffDays < 7) return m.time_days_ago(diffDays);
	const diffWeeks = Math.floor(diffDays / 7);
	if (diffWeeks < 4) return m.time_weeks_ago(diffWeeks);
	const then = new Date(timestamp);
	return then.toLocaleDateString(locale, {
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

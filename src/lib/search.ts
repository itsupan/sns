/** The trigram FTS index (migration 0012) cannot match terms shorter than this. */
export const MIN_TERM_LENGTH = 3;
const MAX_TERMS = 8;
const MAX_QUERY_LENGTH = 100;

/**
 * The searchable terms of user input, shared by the API (to build the FTS5 query) and the UI
 * (to know whether to search at all, and to highlight hits): whitespace-separated, leading
 * `@`/`#` stripped, at least MIN_TERM_LENGTH characters, deduped, at most MAX_TERMS.
 */
export function searchTermsOf(raw: string): string[] {
	const terms = raw
		.normalize('NFKC')
		.slice(0, MAX_QUERY_LENGTH)
		// Control characters (incl. NUL) are never useful in a search term.
		// eslint-disable-next-line no-control-regex
		.replace(/[\u0000-\u001f\u007f]/g, ' ')
		.split(/\s+/)
		.map((t) => t.replace(/^[@#]+/, ''))
		.filter((t) => [...t].length >= MIN_TERM_LENGTH);
	return [...new Set(terms)].slice(0, MAX_TERMS);
}

/** Splits `text` into plain and matching segments for rendering highlights without HTML. */
export function highlightSegments(
	text: string,
	terms: string[]
): Array<{ text: string; hit: boolean }> {
	const needles = terms.map((t) => t.toLowerCase()).filter(Boolean);
	if (needles.length === 0) return [{ text, hit: false }];
	const lower = text.toLowerCase();
	const segments: Array<{ text: string; hit: boolean }> = [];
	let i = 0;
	let plainStart = 0;
	while (i < text.length) {
		const needle = needles.find((n) => lower.startsWith(n, i));
		if (needle) {
			if (plainStart < i) segments.push({ text: text.slice(plainStart, i), hit: false });
			segments.push({ text: text.slice(i, i + needle.length), hit: true });
			i += needle.length;
			plainStart = i;
		} else {
			i++;
		}
	}
	if (plainStart < text.length) segments.push({ text: text.slice(plainStart), hit: false });
	return segments;
}

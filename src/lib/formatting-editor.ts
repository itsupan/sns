/** Textarea helpers for the formatting toolbar and Ctrl/Cmd+B/I/U shortcuts (#123). */

export type FormatKind = 'bold' | 'italic' | 'underline' | 'list';

const MARKERS: Record<Exclude<FormatKind, 'list'>, string> = {
	bold: '**',
	italic: '*',
	underline: '__'
};

export interface EditResult {
	value: string;
	start: number;
	end: number;
}

/** Pure transform: apply a format to `value` with selection [start, end). */
export function applyFormat(
	value: string,
	start: number,
	end: number,
	kind: FormatKind
): EditResult {
	if (kind === 'list') {
		const lineStart = value.lastIndexOf('\n', start - 1) + 1;
		const nl = value.indexOf('\n', end > start ? end - 1 : end);
		const lineEnd = nl === -1 ? value.length : nl;
		const lines = value.slice(lineStart, lineEnd).split('\n');
		const allListed = lines.every((l) => /^[-*] /.test(l));
		const next = lines.map((l) => (allListed ? l.slice(2) : `- ${l}`)).join('\n');
		const out = value.slice(0, lineStart) + next + value.slice(lineEnd);
		const delta = next.length - (lineEnd - lineStart);
		return lines.length === 1
			? {
					value: out,
					start: Math.max(lineStart, start + delta),
					end: Math.max(lineStart, end + delta)
				}
			: { value: out, start: lineStart, end: lineEnd + delta };
	}
	const m = MARKERS[kind];
	const before = value.slice(0, start);
	const sel = value.slice(start, end);
	const after = value.slice(end);
	// Toggle off when the selection is already wrapped with this marker.
	if (before.endsWith(m) && after.startsWith(m)) {
		return {
			value: before.slice(0, -m.length) + sel + after.slice(m.length),
			start: start - m.length,
			end: end - m.length
		};
	}
	return { value: before + m + sel + m + after, start: start + m.length, end: end + m.length };
}

const KEYS: Record<string, FormatKind> = { b: 'bold', i: 'italic', u: 'underline' };

/** Apply a format to a live textarea, respecting its maxlength. Returns the new value or null. */
export function formatTextarea(node: HTMLTextAreaElement, kind: FormatKind): string | null {
	const r = applyFormat(node.value, node.selectionStart, node.selectionEnd, kind);
	if (node.maxLength > 0 && r.value.length > node.maxLength) return null;
	node.value = r.value;
	node.focus();
	node.setSelectionRange(r.start, r.end);
	// Let bindings (and autogrow) see the change.
	node.dispatchEvent(new Event('input', { bubbles: true }));
	return r.value;
}

/** Svelte action: Ctrl/Cmd + B / I / U on a textarea. */
export function formatShortcuts(node: HTMLTextAreaElement) {
	const onKey = (e: KeyboardEvent) => {
		if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
		const kind = KEYS[e.key.toLowerCase()];
		if (!kind) return;
		e.preventDefault();
		formatTextarea(node, kind);
	};
	node.addEventListener('keydown', onKey);
	return { destroy: () => node.removeEventListener('keydown', onKey) };
}

/** The `@handle` being typed just before the caret: where its `@` is and what follows it. */
export function mentionAt(value: string, caret: number): { start: number; query: string } | null {
	const match = /(?:^|[^\w@.])@([a-z0-9_.-]{0,30})$/i.exec(value.slice(0, caret));
	return match ? { start: caret - match[1].length - 1, query: match[1] } : null;
}

/** Replaces the mention typed from `start` to `caret` with `@handle ` and puts the caret after it. */
export function insertMention(
	value: string,
	start: number,
	caret: number,
	handle: string
): EditResult {
	const text = `@${handle} `;
	const end = start + text.length;
	return { value: value.slice(0, start) + text + value.slice(caret), start: end, end };
}

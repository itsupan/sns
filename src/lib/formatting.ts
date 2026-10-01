/**
 * Safe Markdown-subset formatting for post text (#123).
 *
 * Everything is HTML-escaped FIRST; only a fixed set of tags we emit ourselves
 * (<strong>, <em>, <u>, <ul>, <ol>, <li>, <p>, <br>) can appear in the output.
 * No links, no attributes, no raw HTML — so the result is safe for {@html}.
 */

const ESCAPES: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;'
};

export function escapeHtml(src: string): string {
	return src.replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

const BULLET = /^[-*] +(.*)$/;
const ORDERED = /^\d{1,9}\. +(.*)$/;

// Inner text must not start/end with whitespace so "a * b * c" stays literal.
const INNER = String.raw`(\S(?:[^\n]*?\S)?)`;
const UNDERLINE = new RegExp(String.raw`(?<![\w_])__${INNER}__(?![\w_])`, 'g');
const BOLD = new RegExp(String.raw`\*\*${INNER}\*\*`, 'g');
const ITALIC_STAR = new RegExp(String.raw`(?<!\*)\*(?!\*)${INNER}(?<!\*)\*(?!\*)`, 'g');
const ITALIC_UNDER = new RegExp(String.raw`(?<![\w_])_(?!_)${INNER}(?<!_)_(?![\w_])`, 'g');

function inline(escaped: string): string {
	return escaped
		.replace(UNDERLINE, '<u>$1</u>')
		.replace(BOLD, '<strong>$1</strong>')
		.replace(ITALIC_STAR, '<em>$1</em>')
		.replace(ITALIC_UNDER, '<em>$1</em>');
}

function renderBlock(lines: string[]): string {
	const out: string[] = [];
	let text: string[] = [];
	let list: { tag: 'ul' | 'ol'; items: string[] } | null = null;

	const flushText = () => {
		if (text.length) out.push(`<p>${text.map(inline).join('<br>')}</p>`);
		text = [];
	};
	const flushList = () => {
		if (list)
			out.push(
				`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`
			);
		list = null;
	};

	for (const line of lines) {
		const b = BULLET.exec(line);
		const o = b ? null : ORDERED.exec(line);
		const tag = b ? 'ul' : o ? 'ol' : null;
		if (tag) {
			flushText();
			if (list && list.tag !== tag) flushList();
			list ??= { tag, items: [] };
			list.items.push((b ?? o)![1]);
		} else {
			flushList();
			text.push(line);
		}
	}
	flushText();
	flushList();
	return out.join('');
}

/** Render post text to safe HTML. */
export function renderFormatted(src: string): string {
	const escaped = escapeHtml(src ?? '').replace(/\r\n?/g, '\n');
	return escaped
		.split(/\n[ \t]*\n+/)
		.map((b) => b.replace(/^\n+|\n+$/g, ''))
		.filter((b) => b.trim() !== '')
		.map((b) => renderBlock(b.split('\n')))
		.join('');
}

/** Remove formatting markers, for plain-text previews (meta tags, share text, snippets). */
export function stripFormatting(src: string): string {
	return (src ?? '')
		.replace(UNDERLINE, '$1')
		.replace(BOLD, '$1')
		.replace(ITALIC_STAR, '$1')
		.replace(ITALIC_UNDER, '$1')
		.replace(/^[-*] +/gm, '• ');
}

import { describe, expect, it } from 'vitest';
import { escapeHtml, renderFormatted, stripFormatting } from './formatting';
import { applyFormat } from './formatting-editor';

describe('renderFormatted', () => {
	it('renders plain text as a paragraph', () => {
		expect(renderFormatted('hello')).toBe('<p>hello</p>');
		expect(renderFormatted('')).toBe('');
		expect(renderFormatted('   \n\n ')).toBe('');
	});

	it('handles line breaks and paragraphs', () => {
		expect(renderFormatted('a\nb')).toBe('<p>a<br>b</p>');
		expect(renderFormatted('a\n\nb')).toBe('<p>a</p><p>b</p>');
		expect(renderFormatted('a\r\n\r\n\r\nb')).toBe('<p>a</p><p>b</p>');
	});

	it('renders bold, italic and underline', () => {
		expect(renderFormatted('**b**')).toBe('<p><strong>b</strong></p>');
		expect(renderFormatted('*i* and _j_')).toBe('<p><em>i</em> and <em>j</em></p>');
		expect(renderFormatted('__u__')).toBe('<p><u>u</u></p>');
		expect(renderFormatted('**bold with *italic* inside**')).toBe(
			'<p><strong>bold with <em>italic</em> inside</strong></p>'
		);
		expect(renderFormatted('__*x*__')).toBe('<p><u><em>x</em></u></p>');
	});

	it('leaves mid-word underscores and unmatched markers literal', () => {
		expect(renderFormatted('snake_case_name')).toBe('<p>snake_case_name</p>');
		expect(renderFormatted('my__dunder__var')).toBe('<p>my__dunder__var</p>');
		expect(renderFormatted('2 * 3 * 4')).toBe('<p>2 * 3 * 4</p>');
		expect(renderFormatted('**open')).toBe('<p>**open</p>');
		expect(renderFormatted('a _b')).toBe('<p>a _b</p>');
		expect(renderFormatted('**a\nb**')).toBe('<p>**a<br>b**</p>');
	});

	it('renders bullet and ordered lists', () => {
		expect(renderFormatted('- a\n* b')).toBe('<ul><li>a</li><li>b</li></ul>');
		expect(renderFormatted('1. a\n2. **b**')).toBe(
			'<ol><li>a</li><li><strong>b</strong></li></ol>'
		);
		expect(renderFormatted('intro\n- a\n- b\noutro')).toBe(
			'<p>intro</p><ul><li>a</li><li>b</li></ul><p>outro</p>'
		);
		expect(renderFormatted('- a\n1. b')).toBe('<ul><li>a</li></ul><ol><li>b</li></ol>');
		expect(renderFormatted('-not a list')).toBe('<p>-not a list</p>');
	});

	describe('XSS', () => {
		it('escapes script tags', () => {
			const out = renderFormatted('<script>alert(1)</script>');
			expect(out).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
		});

		it('escapes img onerror', () => {
			const out = renderFormatted('<img src=x onerror="alert(1)">');
			expect(out).not.toContain('<img');
			expect(out).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
		});

		it('escapes attribute-breaking quotes', () => {
			const out = renderFormatted(`"'><svg onload=alert(1)>`);
			expect(out).toBe('<p>&quot;&#39;&gt;&lt;svg onload=alert(1)&gt;</p>');
		});

		it('escapes html inside markers and list items', () => {
			expect(renderFormatted('**<b onclick=x>hi</b>**')).toBe(
				'<p><strong>&lt;b onclick=x&gt;hi&lt;/b&gt;</strong></p>'
			);
			expect(renderFormatted('- <iframe src="javascript:x">')).toBe(
				'<ul><li>&lt;iframe src=&quot;javascript:x&quot;&gt;</li></ul>'
			);
		});

		it('does not create links', () => {
			expect(renderFormatted('[x](javascript:alert(1)) https://a.b')).not.toContain('<a');
		});

		it('only emits whitelisted tags', () => {
			const out = renderFormatted('<a>**<x>**_<y>_\n\n- <z>\n1. &amp;');
			const tags = [...out.matchAll(/<\/?([a-z]+)/g)].map((m) => m[1]);
			for (const t of tags) expect(['p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li']).toContain(t);
			expect(out).toContain('&amp;amp;');
		});
	});
});

describe('escapeHtml', () => {
	it('escapes all five characters', () => {
		expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
	});
});

describe('stripFormatting', () => {
	it('removes markers but keeps text', () => {
		expect(stripFormatting('**b** *i* _j_ __u__')).toBe('b i j u');
		expect(stripFormatting('snake_case and 2 * 3')).toBe('snake_case and 2 * 3');
		expect(stripFormatting('- a\n- b')).toBe('• a\n• b');
	});
});

describe('applyFormat', () => {
	it('wraps and unwraps a selection', () => {
		expect(applyFormat('a word b', 2, 6, 'bold')).toEqual({
			value: 'a **word** b',
			start: 4,
			end: 8
		});
		expect(applyFormat('a **word** b', 4, 8, 'bold')).toEqual({
			value: 'a word b',
			start: 2,
			end: 6
		});
		expect(applyFormat('x', 1, 1, 'underline')).toEqual({ value: 'x____', start: 3, end: 3 });
	});

	it('toggles list markers on selected lines', () => {
		expect(applyFormat('a\nb', 0, 3, 'list').value).toBe('- a\n- b');
		expect(applyFormat('- a\n- b', 0, 7, 'list').value).toBe('a\nb');
		expect(applyFormat('x\nab', 3, 3, 'list')).toEqual({ value: 'x\n- ab', start: 5, end: 5 });
	});
});

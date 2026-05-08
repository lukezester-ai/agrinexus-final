/**
 * Прост HTML → чист текст за RAG индексиране.
 *
 * Без външни зависимости — изхвърля script/style/noscript, превръща <br>/<p>/<li>
 * в нови редове и декодира основните HTML entities. Резултатът става готов вход
 * за content-chunker.
 */
const NAMED_ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: ' ',
	laquo: '«',
	raquo: '»',
	ndash: '–',
	mdash: '—',
	hellip: '…',
	bdquo: '„',
	ldquo: '“',
	rdquo: '”',
	lsquo: '‘',
	rsquo: '’',
};

function decodeEntities(s: string): string {
	return s
		.replace(/&#(\d+);/g, (_, n) => {
			const code = Number(n);
			return Number.isFinite(code) && code > 0 && code < 0x10ffff
				? String.fromCodePoint(code)
				: '';
		})
		.replace(/&#x([0-9a-fA-F]+);/g, (_, n) => {
			const code = Number.parseInt(n, 16);
			return Number.isFinite(code) && code > 0 && code < 0x10ffff
				? String.fromCodePoint(code)
				: '';
		})
		.replace(/&([a-zA-Z]+);/g, (m, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? m);
}

const TITLE_RE = /<title[^>]*>([\s\S]*?)<\/title>/i;
const SCRIPT_RE = /<script\b[\s\S]*?<\/script>/gi;
const STYLE_RE = /<style\b[\s\S]*?<\/style>/gi;
const NOSCRIPT_RE = /<noscript\b[\s\S]*?<\/noscript>/gi;
const COMMENT_RE = /<!--[\s\S]*?-->/g;
const SVG_RE = /<svg\b[\s\S]*?<\/svg>/gi;
const IFRAME_RE = /<iframe\b[\s\S]*?<\/iframe>/gi;

const BLOCK_BREAK_RE =
	/<\/?(?:p|div|h[1-6]|li|ul|ol|tr|td|th|table|section|article|header|footer|nav|aside|blockquote|figure|figcaption|hr|br)\b[^>]*>/gi;

export type StrippedHtml = {
	title: string | null;
	text: string;
};

export function stripHtmlToText(html: string): StrippedHtml {
	const titleMatch = html.match(TITLE_RE);
	const title = titleMatch
		? decodeEntities(titleMatch[1].replace(/\s+/g, ' ').trim())
		: null;

	let cleaned = html
		.replace(SCRIPT_RE, ' ')
		.replace(STYLE_RE, ' ')
		.replace(NOSCRIPT_RE, ' ')
		.replace(COMMENT_RE, ' ')
		.replace(SVG_RE, ' ')
		.replace(IFRAME_RE, ' ')
		.replace(BLOCK_BREAK_RE, '\n')
		.replace(/<[^>]+>/g, ' ');

	cleaned = decodeEntities(cleaned)
		.replace(/[ \t\f\v]+/g, ' ')
		.replace(/\n[ \t]+/g, '\n')
		.replace(/[ \t]+\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();

	return { title, text: cleaned };
}

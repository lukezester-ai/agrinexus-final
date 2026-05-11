export type StooqRow = {
	symbol: string;
	date: string;
	time: string;
	open: number;
	high: number;
	low: number;
	close: number;
	ok: boolean;
};

function parseNum(raw: string): number | null {
	const t = raw?.trim();
	if (!t || t === 'N/D' || t === '') return null;
	const n = Number(t.replace(',', '.'));
	return Number.isFinite(n) ? n : null;
}

/** Fetch last daily/intraday bar for many symbols (Stooq batch with +). */
export async function fetchStooqBatch(symbols: string[]): Promise<StooqRow[]> {
	if (symbols.length === 0) return [];
	const query = symbols.map(s => s.toLowerCase()).join('+');
	const url = `https://stooq.com/q/l/?s=${query}&f=sd2t2ohlcv&h&e=csv`;

	const ac = new AbortController();
	const timer = setTimeout(() => ac.abort(), 14_000);
	try {
		const res = await fetch(url, {
			signal: ac.signal,
			headers: {
				'User-Agent': 'SIMAMarketQuotes/1.0',
				Accept: 'text/csv,*/*',
			},
		});
		if (!res.ok) throw new Error(`Stooq HTTP ${res.status}`);
		const text = await res.text();
		const lines = text
			.split(/\r?\n/)
			.map(l => l.trim())
			.filter(Boolean);
		if (lines.length < 2) throw new Error('Stooq empty response');

		const out: StooqRow[] = [];
		for (let i = 1; i < lines.length; i++) {
			const cols = lines[i].split(',');
			if (cols.length < 7) continue;
			const symbol = cols[0]?.trim() ?? '';
			const date = cols[1]?.trim() ?? '';
			const time = cols[2]?.trim() ?? '';
			const open = parseNum(cols[3] ?? '');
			const high = parseNum(cols[4] ?? '');
			const low = parseNum(cols[5] ?? '');
			const close = parseNum(cols[6] ?? '');
			const ok =
				Boolean(symbol) &&
				open !== null &&
				high !== null &&
				low !== null &&
				close !== null;
			out.push({
				symbol,
				date,
				time,
				open: open ?? 0,
				high: high ?? 0,
				low: low ?? 0,
				close: close ?? 0,
				ok,
			});
		}
		return out;
	} finally {
		clearTimeout(timer);
	}
}

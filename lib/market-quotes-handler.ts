import { uniqueInstrumentSymbols } from './market-instruments';
import { fetchStooqBatch, type StooqRow } from './stooq-fetch';

export type MarketQuotePayload = {
	symbol: string;
	open: number;
	close: number;
	date: string;
	time: string;
};

export type MarketQuotesResult =
	| {
			ok: true;
			mode: 'demo';
			quotes: [];
			fetchedAt: string;
			source: null;
	  }
	| {
			ok: true;
			mode: 'live';
			quotes: MarketQuotePayload[];
			fetchedAt: string;
			source: 'stooq_delayed';
	  }
	| {
			ok: false;
			mode: 'error';
			quotes: [];
			fetchedAt: string;
			source: null;
			error: string;
	  };

function rowToPayload(row: StooqRow): MarketQuotePayload | null {
	if (!row.ok) return null;
	return {
		symbol: row.symbol.toLowerCase(),
		open: row.open,
		close: row.close,
		date: row.date,
		time: row.time,
	};
}

export async function handleMarketQuotesGet(): Promise<MarketQuotesResult> {
	const fetchedAt = new Date().toISOString();
	const provider = process.env.MARKET_QUOTES_PROVIDER?.trim().toLowerCase();

	if (provider === 'demo') {
		return { ok: true, mode: 'demo', quotes: [], fetchedAt, source: null };
	}

	const symbols = uniqueInstrumentSymbols();
	try {
		const rows = await fetchStooqBatch(symbols);
		const quotes = rows.map(rowToPayload).filter((q): q is MarketQuotePayload => q !== null);
		if (quotes.length === 0) {
			return {
				ok: false,
				mode: 'error',
				quotes: [],
				fetchedAt,
				source: null,
				error: 'No usable quotes returned from feed.',
			};
		}
		return {
			ok: true,
			mode: 'live',
			quotes,
			fetchedAt,
			source: 'stooq_delayed',
		};
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return {
			ok: false,
			mode: 'error',
			quotes: [],
			fetchedAt,
			source: null,
			error: msg,
		};
	}
}

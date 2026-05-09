import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2, RefreshCw, LineChart } from 'lucide-react';
import type { AppStrings, UiLang } from '../lib/i18n';
import { localeTagFor } from '../lib/i18n';
import { PRODUCT_INSTRUMENT } from '../lib/market-instruments';

export type MarketWatchViewProps = {
	lang: UiLang;
	tr: AppStrings;
	onBackToMarket: () => void;
};

type StatRow = {
	samples?: number;
	lastClose?: number;
	lastDate?: string;
	sma20?: number;
	deltaPct?: number;
	trendLabel?: string;
};

type WatchPayload = {
	persistCount?: number;
	lastPersistAt?: string;
	symbolStats?: Record<string, StatRow>;
	snapshotsMeta?: Array<{ at: string; rows: number }>;
	marketModels?: Array<{ id: string; labelBg: string; symbols: string[]; thesisBg?: string }>;
	lastInsights?: {
		at?: string;
		summaryBg?: string;
		predictionsBg?: string;
		error?: string;
	};
};

type QuoteRow = { symbol: string; close: number; date: string; time?: string; open?: number };

function labelForSymbol(sym: string, lang: UiLang): string {
	const s = sym.toLowerCase();
	for (const [product, meta] of Object.entries(PRODUCT_INSTRUMENT)) {
		if (meta?.symbol.toLowerCase() === s) {
			return `${product} (${lang === 'bg' ? meta.unitBg : meta.unitEn})`;
		}
	}
	return sym;
}

function trendWord(t: string | undefined, lang: UiLang): string {
	if (t === 'up') return lang === 'bg' ? 'Нагоре' : 'Up';
	if (t === 'down') return lang === 'bg' ? 'Надолу' : 'Down';
	if (t === 'flat') return lang === 'bg' ? 'Платно' : 'Flat';
	return '—';
}

function trendColor(t: string | undefined): string {
	if (t === 'up') return '#86efac';
	if (t === 'down') return '#fca5a5';
	if (t === 'flat') return '#fcd34d';
	return 'var(--text-muted)';
}

function formatFetchedAt(iso: string, lang: UiLang): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	return d.toLocaleString(localeTagFor(lang), { dateStyle: 'short', timeStyle: 'short' });
}

function parseBody(raw: unknown): {
	ok: boolean;
	mode: string;
	quotes: QuoteRow[];
	fetchedAt: string;
	source: string | null;
	error?: string;
	watch: WatchPayload | null;
} {
	if (!raw || typeof raw !== 'object') {
		return {
			ok: false,
			mode: 'error',
			quotes: [],
			fetchedAt: new Date().toISOString(),
			source: null,
			error: 'Invalid response',
			watch: null,
		};
	}
	const o = raw as Record<string, unknown>;
	const quotes = Array.isArray(o.quotes) ? (o.quotes as QuoteRow[]) : [];
	const watch =
		o.watch && typeof o.watch === 'object' ? (o.watch as WatchPayload) : null;
	return {
		ok: Boolean(o.ok),
		mode: typeof o.mode === 'string' ? o.mode : 'error',
		quotes,
		fetchedAt: typeof o.fetchedAt === 'string' ? o.fetchedAt : new Date().toISOString(),
		source: typeof o.source === 'string' || o.source === null ? (o.source as string | null) : null,
		...(typeof o.error === 'string' ? { error: o.error } : {}),
		watch,
	};
}

export function MarketWatchView({ lang, tr, onBackToMarket }: MarketWatchViewProps) {
	const [payload, setPayload] = useState<ReturnType<typeof parseBody> | null>(null);
	const [busy, setBusy] = useState(false);
	const [hasCompletedOnce, setHasCompletedOnce] = useState(false);
	const [fetchErr, setFetchErr] = useState<string | null>(null);

	const load = useCallback(async () => {
		setFetchErr(null);
		setBusy(true);
		try {
			const res = await fetch('/api/market-watch');
			const raw = await res.json().catch(() => null);
			setPayload(parseBody(raw));
		} catch (e) {
			setFetchErr(e instanceof Error ? e.message : 'Network error');
			setPayload(null);
		} finally {
			setBusy(false);
			setHasCompletedOnce(true);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const statsEntries = useMemo(() => {
		const raw = payload?.watch?.symbolStats;
		if (!raw || typeof raw !== 'object') return [];
		return Object.entries(raw).sort(([a], [b]) =>
			labelForSymbol(a, lang).localeCompare(labelForSymbol(b, lang), localeTagFor(lang)),
		);
	}, [payload?.watch?.symbolStats, lang]);

	const sortedQuotes = useMemo(() => {
		if (!payload?.quotes.length) return [];
		return [...payload.quotes].sort((a, b) =>
			labelForSymbol(a.symbol, lang).localeCompare(labelForSymbol(b.symbol, lang), localeTagFor(lang)),
		);
	}, [payload?.quotes, lang]);

	const models = payload?.watch?.marketModels ?? [];

	const snapMeta = payload?.watch?.snapshotsMeta ?? [];

	const refreshBlocked = busy && !hasCompletedOnce;

	return (
		<section
			className="section"
			aria-busy={busy}
			style={{
				transition: 'opacity 0.2s ease',
				opacity: busy && payload ? 0.94 : 1,
			}}>
			<div
				style={{
					display: 'flex',
					alignItems: 'flex-start',
					justifyContent: 'space-between',
					gap: 12,
					flexWrap: 'wrap',
					marginBottom: 16,
				}}>
				<div style={{ minWidth: 0 }}>
					<button type="button" className="btn btn-outline" onClick={onBackToMarket} style={{ marginBottom: 10 }}>
						<ArrowLeft size={16} aria-hidden /> {tr.marketWatchBackMarket}
					</button>
					<h2 style={{ margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
						<LineChart color="#7ccd9c" size={26} aria-hidden />
						{tr.marketWatchTitle}
					</h2>
					<p className="muted" style={{ margin: 0, maxWidth: 720, lineHeight: 1.5 }}>
						{tr.marketWatchSubtitle}
					</p>
					{payload ? (
						<p className="muted" style={{ margin: '10px 0 0', fontSize: '.78rem' }}>
							{tr.marketWatchUpdated}: {formatFetchedAt(payload.fetchedAt, lang)}
							{busy && payload ? (
								<>
									{' '}
									<span style={{ color: 'var(--accent)' }} aria-live="polite">
										({tr.marketWatchRefreshingShort})
									</span>
								</>
							) : null}
						</p>
					) : null}
				</div>
				<button
					type="button"
					className="btn btn-primary"
					disabled={refreshBlocked}
					onClick={() => void load()}
					style={{ flexShrink: 0 }}>
					{busy ? <Loader2 size={18} className="spin" aria-hidden /> : <RefreshCw size={18} aria-hidden />}
					{tr.marketWatchRefresh}
				</button>
			</div>

			{fetchErr ? (
				<div className="demo-banner" role="alert" style={{ borderColor: 'rgba(248, 113, 113, 0.35)' }}>
					{fetchErr}
				</div>
			) : null}

			{busy && !payload ? (
				<p className="muted" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
					<Loader2 size={18} className="spin" aria-hidden /> {tr.marketWatchLoading}
				</p>
			) : null}

			{payload && !fetchErr ? (
				payload.mode === 'demo' ? (
					<div className="demo-banner">{tr.marketWatchDemoMode}</div>
				) : payload.mode === 'error' ? (
					<div className="demo-banner">{payload.error ?? tr.liveMarketErrorBanner}</div>
				) : payload.ok && payload.mode === 'live' ? (
					<div className="demo-banner" style={{ borderColor: 'rgba(124, 205, 156, 0.35)' }}>
						{tr.liveMarketBannerStooq}
					</div>
				) : null
			) : null}

			{payload && sortedQuotes.length > 0 ? (
				<div style={{ marginTop: 18 }}>
					<h3 style={{ margin: '0 0 10px', fontSize: '1.05rem' }}>{tr.marketWatchQuotesTitle}</h3>
					<div className="table-shell">
						<table className="data-table">
							<thead>
								<tr>
									<th>
										{lang === 'bg' ? 'Инструмент' : 'Instrument'}
									</th>
									<th>
										{lang === 'bg' ? 'Последна' : 'Last'}
									</th>
									<th>
										{lang === 'bg' ? 'Дата' : 'Date'}
									</th>
								</tr>
							</thead>
							<tbody>
								{sortedQuotes.map(q => (
									<tr key={q.symbol}>
										<td style={{ fontWeight: 650 }}>{labelForSymbol(q.symbol, lang)}</td>
										<td style={{ color: 'var(--accent-text)', fontVariantNumeric: 'tabular-nums' }}>
											{Number.isFinite(q.close) ? q.close.toLocaleString(localeTagFor(lang)) : '—'}
										</td>
										<td style={{ color: 'var(--text-muted)' }}>
											{q.date}
											{q.time ? ` · ${q.time}` : ''}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			) : null}

			{payload && hasCompletedOnce && statsEntries.length === 0 ? (
				<p className="muted" style={{ marginTop: 18 }}>
					{tr.marketWatchEmptyTracked}
				</p>
			) : null}

			{payload && statsEntries.length > 0 ? (
				<div style={{ marginTop: 22 }}>
					<h3 style={{ margin: '0 0 10px', fontSize: '1.05rem' }}>{tr.marketWatchTrackedTitle}</h3>
					<p className="muted" style={{ margin: '0 0 12px', fontSize: '.82rem' }}>
						{lang === 'bg' ? 'Записи:' : 'Snapshots:'}{' '}
						<strong style={{ color: 'var(--accent-text)' }}>{payload.watch?.persistCount ?? 0}</strong>
						{payload.watch?.lastPersistAt
							? ` · ${lang === 'bg' ? 'последно' : 'last'} ${payload.watch.lastPersistAt}`
							: ''}
					</p>
					{snapMeta.length > 0 ? (
						<div style={{ marginBottom: 14 }}>
							<p className="muted" style={{ margin: '0 0 8px', fontSize: '.78rem', fontWeight: 650 }}>
								{tr.marketWatchSnapshotsRecent}
							</p>
							<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
								{snapMeta.slice(-8).map((s, idx) => (
									<span
										key={`${s.at}-${idx}`}
										style={{
											fontSize: '.72rem',
											padding: '4px 10px',
											borderRadius: 999,
											border: '1px solid rgba(124, 205, 156, 0.25)',
											background: 'rgba(16, 31, 24, 0.85)',
											color: 'var(--text-muted)',
										}}>
										{s.at.slice(0, 19).replace('T', ' ')} · {s.rows}×
									</span>
								))}
							</div>
						</div>
					) : null}
					<div className="grid" style={{ marginTop: 8 }}>
						{statsEntries.map(([sym, row]) => (
							<div key={sym} className="terminal-metric">
								<span>{labelForSymbol(sym, lang)}</span>
								<strong style={{ marginTop: 6 }}>
									{typeof row.lastClose === 'number'
										? row.lastClose.toLocaleString(localeTagFor(lang))
										: '—'}
								</strong>
								<span style={{ marginTop: 4, color: trendColor(row.trendLabel), fontWeight: 650 }}>
									{trendWord(row.trendLabel, lang)}
									{typeof row.deltaPct === 'number'
										? ` · ${row.deltaPct >= 0 ? '+' : ''}${row.deltaPct.toFixed(2)}%`
										: ''}
								</span>
								<span style={{ marginTop: 4 }}>
									SMA20
									{typeof row.sma20 === 'number'
										? `: ${row.sma20.toLocaleString(localeTagFor(lang), { maximumFractionDigits: 2 })}`
										: ': —'}
								</span>
								<span style={{ marginTop: 4 }}>
									{typeof row.samples === 'number' ? `${row.samples} ${tr.marketWatchSamples}` : ''}
								</span>
							</div>
						))}
					</div>
				</div>
			) : null}

			{payload && models.length > 0 ? (
				<div style={{ marginTop: 22 }}>
					<h3 style={{ margin: '0 0 10px', fontSize: '1.05rem' }}>{tr.marketWatchModelsTitle}</h3>
					<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
						{models.map(m => (
							<div key={m.id} className="contact-panel" style={{ marginTop: 0 }}>
								<strong style={{ fontSize: '.95rem' }}>{m.labelBg}</strong>
								{m.thesisBg ? (
									<p className="muted" style={{ margin: '8px 0 0', fontSize: '.88rem', lineHeight: 1.5 }}>
										{m.thesisBg}
									</p>
								) : null}
								<p className="muted" style={{ margin: '8px 0 0', fontSize: '.82rem' }}>
									{m.symbols.join(', ')}
								</p>
							</div>
						))}
					</div>
				</div>
			) : payload && (payload.watch?.persistCount ?? 0) > 0 ? (
				<p className="muted" style={{ marginTop: 18 }}>
					{tr.marketWatchNoModels}
				</p>
			) : null}

			{payload?.watch?.lastInsights &&
			(payload.watch.lastInsights.summaryBg || payload.watch.lastInsights.predictionsBg) ? (
				<div style={{ marginTop: 22 }}>
					<h3 style={{ margin: '0 0 8px', fontSize: '1.05rem' }}>{tr.marketWatchInsightsTitle}</h3>
					<p className="muted" style={{ margin: '0 0 12px', fontSize: '.78rem' }}>
						{tr.marketWatchInsightsLangNote}
					</p>
					<div className="contact-panel" style={{ marginTop: 0 }}>
						{payload.watch.lastInsights.summaryBg ? (
							<p style={{ margin: '0 0 14px', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
								{payload.watch.lastInsights.summaryBg}
							</p>
						) : null}
						{payload.watch.lastInsights.predictionsBg ? (
							<p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
								{payload.watch.lastInsights.predictionsBg}
							</p>
						) : null}
						{payload.watch.lastInsights.error ? (
							<p style={{ marginTop: 12, color: '#f87171', fontSize: '.86rem' }}>
								{payload.watch.lastInsights.error}
							</p>
						) : null}
					</div>
				</div>
			) : payload && (payload.watch?.persistCount ?? 0) > 0 ? (
				<p className="muted" style={{ marginTop: 18 }}>
					{tr.marketWatchNoInsights}
				</p>
			) : null}
		</section>
	);
}

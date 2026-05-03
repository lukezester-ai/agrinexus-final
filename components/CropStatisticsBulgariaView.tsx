import { useMemo, useState } from 'react';
import {
	Bar,
	CartesianGrid,
	ComposedChart,
	Legend,
	Line,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from 'recharts';
import { BarChart3, Droplets, TrendingUp } from 'lucide-react';
import type { AppStrings, UiLang } from '../lib/i18n';
import {
	analyzeCropOutlook,
	CROP_PROFILES,
	type CropKey,
	forecastProductionKt,
	isDryStressLikely,
	OUTLOOK_FACTOR_LABELS,
	OUTLOOK_FACTORS_NONE,
	pickL,
} from '../lib/crop-statistics-data';

type Props = {
	lang: UiLang;
	tr: AppStrings;
};

function buildChartRows(profile: (typeof CROP_PROFILES)[number]) {
	const { series } = profile;
	const { nextYear, forecastKt, slopeKtPerYear, intercept } = forecastProductionKt(series);
	const rows = series.map(p => ({
		yearLabel: String(p.year),
		actual: p.kt as number | undefined,
		fit: intercept + slopeKtPerYear * p.year,
	}));
	rows.push({
		yearLabel: String(nextYear),
		actual: undefined,
		fit: forecastKt,
	});
	return { rows, nextYear, forecastKt, slopeKtPerYear, dry: isDryStressLikely(series, slopeKtPerYear) };
}

export function CropStatisticsBulgariaView({ lang, tr }: Props) {
	const [cropKey, setCropKey] = useState<CropKey>('tomatoes');
	const profile = useMemo(
		() => CROP_PROFILES.find(c => c.key === cropKey) ?? CROP_PROFILES[0],
		[cropKey],
	);
	const { rows, nextYear, forecastKt, slopeKtPerYear, dry } = useMemo(
		() => buildChartRows(profile),
		[profile],
	);
	const outlook = useMemo(
		() => analyzeCropOutlook(profile.series, slopeKtPerYear, forecastKt, dry),
		[profile.series, slopeKtPerYear, forecastKt, dry],
	);

	const fmtPctSigned = (p: number) => {
		const sign = p > 0 ? '+' : '';
		return `${sign}${p.toFixed(1)}%`;
	};

	const outlookReasons =
		outlook.factors.length === 0
			? pickL(OUTLOOK_FACTORS_NONE, lang)
			: outlook.factors.map(f => pickL(OUTLOOK_FACTOR_LABELS[f], lang)).join('; ');

	const outlookNarrative =
		outlook.tone === 'headwind'
			? tr.cropStatsOutlookHeadwind.replace('{reasons}', outlookReasons)
			: outlook.tone === 'tailwind'
				? tr.cropStatsOutlookTailwind.replace('{reasons}', outlookReasons)
				: tr.cropStatsOutlookMixed.replace('{reasons}', outlookReasons);

	return (
		<section className="section">
			<div
				style={{
					display: 'flex',
					flexWrap: 'wrap',
					alignItems: 'center',
					justifyContent: 'space-between',
					gap: 12,
					marginBottom: 16,
				}}>
				<h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
					<BarChart3 size={26} color="#5dbd9a" aria-hidden />
					{tr.cropStatsTitle}
				</h2>
			</div>
			<p className="muted" style={{ marginTop: 0 }}>
				{tr.cropStatsSubtitle}
			</p>

			<div style={{ marginBottom: 18 }}>
				<span className="muted" style={{ display: 'block', marginBottom: 8, fontSize: '.9rem' }}>
					{tr.cropStatsPickCrop}
				</span>
				<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
					{CROP_PROFILES.map(c => (
						<button
							key={c.key}
							type="button"
							className={cropKey === c.key ? 'btn btn-primary' : 'btn btn-outline'}
							onClick={() => setCropKey(c.key)}
							style={
								cropKey === c.key
									? { borderColor: c.chartColor, boxShadow: `0 0 0 1px ${c.chartColor}44` }
									: undefined
							}>
							{pickL(c.label, lang)}
						</button>
					))}
				</div>
			</div>

			<div
				className="contact-panel"
				style={{
					borderColor: 'rgba(93, 189, 154, 0.35)',
					padding: '16px 12px 8px',
					marginBottom: 20,
					background: 'linear-gradient(165deg, rgba(45,212,191,0.07) 0%, rgba(15,23,42,0.4) 100%)',
				}}>
				<div style={{ width: '100%', height: 340 }}>
					<ResponsiveContainer width="100%" height="100%">
						<ComposedChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
							<defs>
								<linearGradient id={`barGrad-${profile.key}`} x1="0" y1="0" x2="0" y2="1">
									<stop offset="0%" stopColor={profile.chartColor} stopOpacity={0.95} />
									<stop offset="100%" stopColor={profile.chartColor} stopOpacity={0.35} />
								</linearGradient>
							</defs>
							<CartesianGrid stroke="rgba(148,163,184,0.15)" vertical={false} />
							<XAxis
								dataKey="yearLabel"
								tick={{ fill: '#94a3b8', fontSize: 12 }}
								tickLine={false}
								axisLine={{ stroke: 'rgba(148,163,184,0.25)' }}
							/>
							<YAxis
								tick={{ fill: '#94a3b8', fontSize: 11 }}
								tickLine={false}
								axisLine={{ stroke: 'rgba(148,163,184,0.25)' }}
								width={48}
								label={{
									value: tr.cropStatsYAxisKt,
									angle: -90,
									position: 'insideLeft',
									fill: '#64748b',
									fontSize: 11,
								}}
							/>
							<Tooltip
								contentStyle={{
									background: 'rgba(15,23,42,0.92)',
									border: '1px solid rgba(45,212,191,0.35)',
									borderRadius: 8,
								}}
								labelStyle={{ color: '#e2e8f0' }}
								formatter={(value: unknown, name: unknown) => {
									const n = typeof value === 'number' ? value : Number(value);
									if (value == null || Number.isNaN(n)) return ['—', String(name)];
									return [`${Math.round(n)} ${tr.cropStatsKtShort}`, String(name)];
								}}
								labelFormatter={label => `${tr.cropStatsYearLabel}: ${label}`}
							/>
							<Legend
								wrapperStyle={{ fontSize: 12 }}
								formatter={value => {
									if (value === 'actual') return tr.cropStatsLegendHarvest;
									if (value === 'fit') return tr.cropStatsLegendTrend;
									return value;
								}}
							/>
							<Bar
								dataKey="actual"
								name="actual"
								fill={`url(#barGrad-${profile.key})`}
								radius={[6, 6, 0, 0]}
								maxBarSize={48}
							/>
							<Line
								type="monotone"
								dataKey="fit"
								name="fit"
								stroke="#38bdf8"
								strokeWidth={2.5}
								dot={{ r: 4, fill: '#38bdf8', strokeWidth: 0 }}
								activeDot={{ r: 6 }}
							/>
						</ComposedChart>
					</ResponsiveContainer>
				</div>
			</div>

			<div
				style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
					gap: 14,
					marginBottom: 18,
				}}>
				<div
					className="contact-panel"
					style={{
						margin: 0,
						borderColor: 'rgba(56, 189, 248, 0.35)',
						background: 'rgba(56, 189, 248, 0.06)',
					}}>
					<h3 style={{ margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 8, fontSize: '1rem' }}>
						<TrendingUp size={18} color="#38bdf8" aria-hidden />
						{tr.cropStatsForecastTitle}
					</h3>
					<p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>
						{tr.cropStatsForecastIntro
							.replace(/\{year\}/g, String(nextYear))
							.replace(/\{kt\}/g, String(Math.round(forecastKt)))}
					</p>
					<p
						className="muted"
						style={{
							margin: '14px 0 8px',
							fontWeight: 700,
							fontSize: '.82rem',
							letterSpacing: '0.04em',
							textTransform: 'uppercase',
							color: '#94a3b8',
						}}>
						{tr.cropStatsCompareHeading}
					</p>
					<ul
						className="muted"
						style={{
							margin: '0 0 12px',
							paddingLeft: '1.15rem',
							lineHeight: 1.55,
							fontSize: '.92rem',
						}}>
						<li style={{ marginBottom: 6 }}>
							{tr.cropStatsVsLastDetail
								.replace(/\{year\}/g, String(outlook.lastYear))
								.replace(/\{lastKt\}/g, String(Math.round(outlook.lastKt)))
								.replace(/\{pctSigned\}/g, fmtPctSigned(outlook.pctVsLast))
								.replace(/\{nextYear\}/g, String(nextYear))}
						</li>
						<li style={{ marginBottom: 6 }}>
							{tr.cropStatsVsAvgDetail
								.replace(/\{avgKt\}/g, String(Math.round(outlook.avgKt)))
								.replace(/\{pctSigned\}/g, fmtPctSigned(outlook.pctVsAvg))}
						</li>
						<li>
							{tr.cropStatsRangeDetail
								.replace(/\{minKt\}/g, String(Math.round(outlook.minKt)))
								.replace(/\{maxKt\}/g, String(Math.round(outlook.maxKt)))
								.replace(/\{minYear\}/g, String(outlook.minYear))
								.replace(/\{maxYear\}/g, String(outlook.maxYear))}
						</li>
					</ul>
					<p
						className="muted"
						style={{
							margin: '0 0 12px',
							lineHeight: 1.58,
							fontSize: '.93rem',
							paddingLeft: 12,
							borderLeft:
								outlook.tone === 'headwind'
									? '3px solid rgba(251, 146, 60, 0.85)'
									: outlook.tone === 'tailwind'
										? '3px solid rgba(93, 189, 154, 0.9)'
										: '3px solid rgba(148, 163, 184, 0.65)',
						}}>
						{outlookNarrative}
					</p>
					<p className="muted" style={{ margin: 0, fontSize: '.88rem', lineHeight: 1.5 }}>
						{pickL(profile.genNotes, lang)}
					</p>
				</div>
				<div
					className="contact-panel"
					style={{
						margin: 0,
						borderColor: dry ? 'rgba(251, 146, 60, 0.45)' : 'rgba(93, 189, 154, 0.28)',
						background: dry ? 'rgba(251, 146, 60, 0.07)' : 'rgba(93, 189, 154, 0.05)',
					}}>
					<h3 style={{ margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 8, fontSize: '1rem' }}>
						<Droplets size={18} color={dry ? '#fb923c' : '#5dbd9a'} aria-hidden />
						{tr.cropStatsIrrigationTitle}
						{dry ? (
							<span
								style={{
									fontSize: '.72rem',
									fontWeight: 700,
									textTransform: 'uppercase',
									letterSpacing: 1,
									color: '#fb923c',
									border: '1px solid rgba(251,146,60,0.5)',
									padding: '2px 8px',
									borderRadius: 6,
								}}>
								{tr.cropStatsDryBadge}
							</span>
						) : null}
					</h3>
					<p className="muted" style={{ margin: '0 0 10px', lineHeight: 1.55 }}>
						{pickL(profile.irrigationGeneral, lang)}
					</p>
					<p className="muted" style={{ margin: 0, lineHeight: 1.55, fontWeight: dry ? 500 : 400 }}>
						<strong style={{ color: dry ? '#fdba74' : '#5eead4' }}>
							{dry ? tr.cropStatsDryLead : tr.cropStatsNormalLead}
						</strong>{' '}
						{dry ? pickL(profile.irrigationIfDry, lang) : tr.cropStatsNormalIrrigationExtra}
					</p>
				</div>
			</div>

			<p
				className="muted"
				style={{
					fontSize: '.85rem',
					padding: '12px 14px',
					borderRadius: 8,
					background: 'rgba(93, 189, 154, 0.06)',
					border: '1px solid rgba(93, 189, 154, 0.22)',
					lineHeight: 1.55,
					margin: 0,
				}}>
				{tr.cropStatsDisclaimer}
			</p>
		</section>
	);
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CloudRain, Download, Loader2, RefreshCw } from 'lucide-react';
import type { AppStrings, UiLang } from '../lib/i18n';
import { FIELD_WATCH_OBLAST_PRESETS } from '../lib/field-watch-oblast-presets';
import type { WeatherForecastPayload } from '../lib/weather-open-meteo';
import { buildMeteoReportPdf } from '../lib/pdf/meteo-report-pdf';

function wmoShort(lang: UiLang, code: number): string {
	const bg: Record<number, string> = {
		0: 'ясно',
		1: 'ясно',
		2: 'облаци',
		3: 'облачно',
		45: 'мъгла',
		51: 'ръмеж',
		61: 'дъжд',
		80: 'валежи',
		95: 'буря',
	};
	const en: Record<number, string> = {
		0: 'clear',
		1: 'clear',
		2: 'clouds',
		3: 'overcast',
		45: 'fog',
		51: 'drizzle',
		61: 'rain',
		80: 'showers',
		95: 'storm',
	};
	const t = lang === 'bg' ? bg : en;
	return t[code] ?? `WMO ${code}`;
}

type Props = {
	lang: UiLang;
	tr: AppStrings;
	onOpenFieldWatch?: () => void;
};

export function WeatherFarmView({ lang, tr, onOpenFieldWatch }: Props) {
	const [cityId, setCityId] = useState('dobrich');
	const preset = useMemo(
		() => FIELD_WATCH_OBLAST_PRESETS.find(c => c.id === cityId) ?? FIELD_WATCH_OBLAST_PRESETS[0],
		[cityId],
	);

	const [data, setData] = useState<WeatherForecastPayload | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [pdfBusy, setPdfBusy] = useState(false);
	const [financeSaved, setFinanceSaved] = useState('');
	const [financeRisk, setFinanceRisk] = useState('');

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const q = new URLSearchParams({
				lat: String(preset.lat),
				lon: String(preset.lon),
			});
			const res = await fetch(`/api/weather-forecast?${q}`);
			const json = (await res.json()) as WeatherForecastPayload | { ok: false; error?: string };
			if (!res.ok || !('ok' in json) || json.ok !== true) {
				setData(null);
				setError(
					typeof json === 'object' && json && 'error' in json && typeof json.error === 'string'
						? json.error
						: tr.weatherLoadError,
				);
				return;
			}
			setData(json);
		} catch {
			setData(null);
			setError(tr.weatherLoadError);
		} finally {
			setLoading(false);
		}
	}, [preset.lat, preset.lon, tr.weatherLoadError]);

	useEffect(() => {
		void load();
	}, [load]);

	const locationLabel = lang === 'bg' ? preset.bg : preset.en;

	const handlePdf = async () => {
		if (!data) return;
		setPdfBusy(true);
		try {
			const bytes = await buildMeteoReportPdf({
				lang,
				locationLabel,
				payload: data,
				financialNotes: {
					savedResource: financeSaved.trim(),
					riskFromDrought: financeRisk.trim(),
				},
			});
			const blob = new Blob([Uint8Array.from(bytes)], { type: 'application/pdf' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			const slug = locationLabel.replace(/\s+/g, '_').slice(0, 40);
			a.download = `SIMA-meteo-${slug}-${data.generatedAt.slice(0, 10)}.pdf`;
			a.click();
			URL.revokeObjectURL(url);
		} finally {
			setPdfBusy(false);
		}
	};

	const cur = data?.current;
	const daily = data?.daily;

	return (
		<section className="section">
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					gap: 12,
					flexWrap: 'wrap',
					marginBottom: 14,
				}}>
				<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
					<CloudRain size={26} aria-hidden style={{ color: 'var(--accent, #0f766e)' }} />
					<div>
						<h2 style={{ margin: 0 }}>{tr.weatherTitle}</h2>
						<p className="muted" style={{ margin: '4px 0 0', fontSize: '.9rem' }}>
							{tr.weatherSubtitle}
						</p>
					</div>
				</div>
				<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
					<button type="button" className="btn btn-outline" disabled={loading} onClick={() => void load()}>
						{loading ? <Loader2 size={16} className="spin" aria-hidden /> : <RefreshCw size={16} aria-hidden />}
						<span style={{ marginLeft: 6 }}>{tr.weatherRefresh}</span>
					</button>
					<button
						type="button"
						className="btn btn-primary"
						disabled={!data || pdfBusy}
						onClick={() => void handlePdf()}>
						{pdfBusy ? <Loader2 size={16} className="spin" aria-hidden /> : <Download size={16} aria-hidden />}
						<span style={{ marginLeft: 6 }}>{tr.weatherDownloadPdf}</span>
					</button>
				</div>
			</div>

			<div
				className="contact-panel"
				style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
				<label style={{ fontSize: '.88rem' }}>{tr.weatherOblastLabel}</label>
				<select value={cityId} onChange={e => setCityId(e.target.value)} style={{ minWidth: 220 }}>
					{FIELD_WATCH_OBLAST_PRESETS.map(c => (
						<option key={c.id} value={c.id}>
							{lang === 'bg' ? c.bg : c.en}
						</option>
					))}
				</select>
				{onOpenFieldWatch ? (
					<button type="button" className="btn btn-outline" onClick={onOpenFieldWatch}>
						{tr.weatherOpenFieldWatch}
					</button>
				) : null}
			</div>

			<div className="contact-panel" style={{ marginBottom: 16, padding: 14 }}>
				<h3 style={{ margin: '0 0 10px', fontSize: '1rem' }}>{tr.weatherFinanceHeading}</h3>
				<div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
					<label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '.88rem' }}>
						<span className="muted">{tr.weatherFinanceSavedLabel}</span>
						<textarea
							rows={2}
							value={financeSaved}
							onChange={e => setFinanceSaved(e.target.value)}
							placeholder={tr.weatherFinancePlaceholderSaved}
							style={{ resize: 'vertical', minHeight: 52, fontFamily: 'inherit', fontSize: '.88rem' }}
						/>
					</label>
					<label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '.88rem' }}>
						<span className="muted">{tr.weatherFinanceRiskLabel}</span>
						<textarea
							rows={2}
							value={financeRisk}
							onChange={e => setFinanceRisk(e.target.value)}
							placeholder={tr.weatherFinancePlaceholderRisk}
							style={{ resize: 'vertical', minHeight: 52, fontFamily: 'inherit', fontSize: '.88rem' }}
						/>
					</label>
				</div>
			</div>

			{error ? (
				<p style={{ color: '#b91c1c', marginBottom: 12 }}>{error}</p>
			) : null}

			{loading && !data ? (
				<p className="muted">{tr.weatherLoading}</p>
			) : null}

			{cur && daily ? (
				<div style={{ display: 'grid', gap: 16 }}>
					<div className="contact-panel" style={{ padding: 16 }}>
						<h3 style={{ margin: '0 0 10px', fontSize: '1rem' }}>{tr.weatherCurrent}</h3>
						<div
							style={{
								display: 'grid',
								gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
								gap: 12,
								fontSize: '.92rem',
							}}>
							<div>
								<span className="muted">{tr.weatherTemp}</span>
								<div style={{ fontWeight: 600 }}>
									{cur.temperature_2m.toFixed(1)} °C
									<span className="muted" style={{ fontWeight: 400, marginLeft: 6 }}>
										({cur.apparent_temperature.toFixed(1)} °C)
									</span>
								</div>
							</div>
							<div>
								<span className="muted">{tr.weatherHumidity}</span>
								<div style={{ fontWeight: 600 }}>{cur.relative_humidity_2m}%</div>
							</div>
							<div>
								<span className="muted">{tr.weatherWind}</span>
								<div style={{ fontWeight: 600 }}>
									{cur.wind_speed_10m.toFixed(0)} km/h · {cur.wind_direction_10m}°
								</div>
							</div>
							<div>
								<span className="muted">{tr.weatherPrecipHour}</span>
								<div style={{ fontWeight: 600 }}>{cur.precipitation.toFixed(1)} mm</div>
							</div>
							<div>
								<span className="muted">{tr.weatherPressure}</span>
								<div style={{ fontWeight: 600 }}>{cur.surface_pressure.toFixed(0)} hPa</div>
							</div>
							<div>
								<span className="muted">{tr.weatherSky}</span>
								<div style={{ fontWeight: 600 }}>{wmoShort(lang, cur.weather_code)}</div>
							</div>
						</div>
						<p className="muted" style={{ margin: '12px 0 0', fontSize: '.82rem' }}>
							{tr.weatherSourceNote}
						</p>
					</div>

					<div className="contact-panel" style={{ padding: 16 }}>
						<h3 style={{ margin: '0 0 10px', fontSize: '1rem' }}>{tr.weatherSevenDay}</h3>
						<div className="table-shell">
							<table className="data-table">
								<thead>
									<tr>
										<th>{tr.weatherDayCol}</th>
										<th>{tr.weatherMinMax}</th>
										<th>{tr.weatherRainCol}</th>
										<th>{tr.weatherPopCol}</th>
										<th>{tr.weatherWindMaxCol}</th>
										<th>{tr.weatherSky}</th>
									</tr>
								</thead>
								<tbody>
									{daily.time.slice(0, 7).map((day, i) => (
										<tr key={day}>
											<td style={{ whiteSpace: 'nowrap' }}>{day}</td>
											<td>
												{daily.temperature_2m_min[i]?.toFixed(0)} –{' '}
												{daily.temperature_2m_max[i]?.toFixed(0)} °C
											</td>
											<td>{daily.precipitation_sum[i]?.toFixed(1)} mm</td>
											<td>{daily.precipitation_probability_max[i]}%</td>
											<td>{daily.wind_speed_10m_max[i]?.toFixed(0)} km/h</td>
											<td>{wmoShort(lang, daily.weather_code[i])}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			) : null}
		</section>
	);
}

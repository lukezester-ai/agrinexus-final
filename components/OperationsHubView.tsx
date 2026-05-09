import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ChangeEvent,
} from 'react';
import {
	Chart as ChartJS,
	CategoryScale,
	LinearScale,
	BarElement,
	LineElement,
	PointElement,
	ArcElement,
	Title,
	Tooltip,
	Legend,
	Filler,
	type ChartOptions,
	type ScriptableContext,
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import type { AppStrings, UiLang } from '../lib/i18n';
import { buildFarmerContextForAi } from '../lib/build-farmer-context-for-ai';
import {
	type FarmDashPersisted,
	type FieldTile,
	type FieldTileStatus,
	FARM_DASH_STORAGE_KEY,
	defaultFarmDash,
	loadFarmDash,
	parseFarmDash,
} from '../lib/farm-dash-schema';
import { fetchFarmDashWeather, type FarmDashWeatherSnap } from '../lib/open-meteo-farm-dash';
import { buildFarmDashReportPdf } from '../lib/pdf/farm-dash-report-pdf';
import { FileDown } from 'lucide-react';

ChartJS.register(
	CategoryScale,
	LinearScale,
	BarElement,
	LineElement,
	PointElement,
	ArcElement,
	Title,
	Tooltip,
	Legend,
	Filler,
);

export type OpsHubNavigate =
	| 'subsidy-calculator'
	| 'crop-statistics'
	| 'season-calendar'
	| 'weather'
	| 'command'
	| 'field-watch'
	| 'trade-documents'
	| 'food-security'
	| 'assistant'
	| 'clients'
	| 'company';

type FarmPage = 'dashboard' | 'fields' | 'weather' | 'harvest' | 'alerts' | 'settings';

const BG_STATUS_LABEL: Record<FieldTileStatus, string> = {
	great: 'Отличен',
	good: 'Добър',
	warn: 'Внимание',
	critical: 'Критичен',
	rest: 'Почивка',
};

const EN_STATUS_LABEL: Record<FieldTileStatus, string> = {
	great: 'Excellent',
	good: 'Good',
	warn: 'Attention',
	critical: 'Critical',
	rest: 'Fallow',
};

const PAGE_TITLE_BG: Record<FarmPage, string> = {
	dashboard: 'Табло',
	fields: 'Полета',
	weather: 'Времето',
	harvest: 'Реколта',
	alerts: 'Известия',
	settings: 'Настройки',
};

const PAGE_TITLE_EN: Record<FarmPage, string> = {
	dashboard: 'Dashboard',
	fields: 'Fields',
	weather: 'Weather',
	harvest: 'Harvest',
	alerts: 'Alerts',
	settings: 'Settings',
};

function weatherIcon(code: number): string {
	if (code === 0) return '☀️';
	if (code <= 2) return '⛅';
	if (code <= 3) return '☁️';
	if (code <= 48) return '🌫️';
	if (code <= 57) return '🌦️';
	if (code <= 67) return '🌧️';
	if (code <= 77) return '❄️';
	if (code <= 82) return '🌧️';
	if (code <= 86) return '🌨️';
	if (code <= 99) return '⛈️';
	return '🌡️';
}

function weatherDesc(code: number, lang: UiLang): string {
	const bg =
		code === 0
			? 'Ясно'
			: code <= 2
				? 'Предимно слънчево'
				: code <= 3
					? 'Облачно'
					: code <= 48
						? 'Мъгла'
						: code <= 57
							? 'Ръмеж'
							: code <= 67
								? 'Дъжд'
								: code <= 77
									? 'Сняг'
									: code <= 82
										? 'Пороен дъжд'
										: code <= 86
											? 'Снеговалеж'
											: code <= 99
												? 'Гръмотевична буря'
												: 'Неизвестно';
	const en =
		code === 0
			? 'Clear'
			: code <= 2
				? 'Mostly sunny'
				: code <= 3
					? 'Overcast'
					: code <= 48
						? 'Fog'
						: code <= 57
							? 'Drizzle'
							: code <= 67
								? 'Rain'
								: code <= 77
									? 'Snow'
									: code <= 82
										? 'Heavy rain'
										: code <= 86
											? 'Snow showers'
											: code <= 99
												? 'Thunderstorm'
												: 'Unknown';
	return lang === 'bg' ? bg : en;
}

function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal.aborted) {
			reject(new DOMException('Aborted', 'AbortError'));
			return;
		}
		const t = window.setTimeout(resolve, ms);
		const onAbort = () => {
			clearTimeout(t);
			reject(new DOMException('Aborted', 'AbortError'));
		};
		signal.addEventListener('abort', onAbort, { once: true });
	});
}

function countStatuses(rows: FieldTile[]): Record<FieldTileStatus, number> {
	const init: Record<FieldTileStatus, number> = {
		great: 0,
		good: 0,
		warn: 0,
		critical: 0,
		rest: 0,
	};
	for (const r of rows) init[r.status] += 1;
	return init;
}

const chartFont = { size: 12, family: 'DM Sans, system-ui, sans-serif' };

const dashboardHarvestOpts: ChartOptions<'bar'> = {
	responsive: true,
	maintainAspectRatio: false,
	plugins: { legend: { display: false } },
	scales: {
		x: { stacked: true, grid: { display: false }, ticks: { font: chartFont } },
		y: { stacked: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: chartFont } },
	},
};

export function OperationsHubView(props: {
	tr: AppStrings;
	lang: UiLang;
	onNavigate: (view: OpsHubNavigate) => void;
}) {
	const { tr, lang, onNavigate } = props;
	const pick = (bg: string, en: string) => (lang === 'bg' ? bg : en);
	const slab = (bg: string, en: string) => (lang === 'bg' ? bg : en);

	const [page, setPage] = useState<FarmPage>('dashboard');
	const [dash, setDash] = useState<FarmDashPersisted>(() => loadFarmDash());
	const [fieldSearch, setFieldSearch] = useState('');
	const [alertFilter, setAlertFilter] = useState<'all' | 'risk' | 'wind' | 'water'>('all');
	const [alertsMarkRead, setAlertsMarkRead] = useState(false);

	const [ragQuestion, setRagQuestion] = useState('');
	const [ragAnswer, setRagAnswer] = useState('');
	const [ragLoading, setRagLoading] = useState(false);
	const [ragError, setRagError] = useState('');

	const statusLabels = lang === 'bg' ? BG_STATUS_LABEL : EN_STATUS_LABEL;
	const statusCounts = useMemo(() => countStatuses(dash.fields), [dash.fields]);

	useEffect(() => {
		const id = window.setTimeout(() => {
			try {
				localStorage.setItem(FARM_DASH_STORAGE_KEY, JSON.stringify(dash));
			} catch {
				/* quota / private mode */
			}
		}, 400);
		return () => clearTimeout(id);
	}, [dash]);

	const [weatherNonce, setWeatherNonce] = useState(0);
	const [weatherLoading, setWeatherLoading] = useState(false);
	const [weatherErr, setWeatherErr] = useState('');
	const [weatherSnap, setWeatherSnap] = useState<FarmDashWeatherSnap | null>(null);
	const [pdfBusy, setPdfBusy] = useState(false);
	const weatherCoordsRef = useRef<{ lat: number; lon: number } | null>(null);
	const dashImportRef = useRef<HTMLInputElement>(null);

	const pageTitle = lang === 'bg' ? PAGE_TITLE_BG[page] : PAGE_TITLE_EN[page];

	const farmerContext = useMemo(() => buildFarmerContextForAi(lang), [lang]);

	const dashboardDealContext = useMemo(
		() =>
			lang === 'bg'
				? '[Operations табло] Локални данни от потребителя (localStorage): статуси на полета, дялове култури, серии за графики; метео от Open-Meteo при зададени координати.'
				: '[Operations dashboard] User-edited local data (localStorage): field statuses, crop shares, chart series; weather from Open-Meteo for stored coordinates.',
		[lang],
	);

	const ragSnapshot = useCallback(() => {
		const countsLine = Object.entries(statusCounts)
			.map(([k, v]) => `${k}:${v}`)
			.join(', ');
		let w = '';
		if (weatherSnap) {
			w = slab(
				`Текущо (Open-Meteo lat ${dash.weatherLat.toFixed(4)}, lon ${dash.weatherLon.toFixed(4)}): ${Math.round(weatherSnap.temp)}°C, ${weatherDesc(weatherSnap.code, lang)}, влажност ${weatherSnap.humidity}%, вятър ${Math.round(weatherSnap.wind)} км/ч.`,
				`Current (Open-Meteo lat ${dash.weatherLat.toFixed(4)}, lon ${dash.weatherLon.toFixed(4)}): ${Math.round(weatherSnap.temp)}°C, ${weatherDesc(weatherSnap.code, lang)}, RH ${weatherSnap.humidity}%, wind ${Math.round(weatherSnap.wind)} km/h.`,
			);
		}
		const cropLine = `cropShares:${dash.cropShares.join('/')}`;
		const hdr =
			lang === 'bg'
				? `--- Табло операции (ваши локални данни) ---\nАктивен екран: ${pageTitle}\n${cropLine}\nРазпределение на полета по статус: ${countsLine}\nКритични полета: ${dash.fields.filter(f => f.status === 'critical')
						.map(f => f.id)
						.join(', ')}\nСредна влажност (7 дни): ${(dash.moisture.reduce((s, x) => s + x, 0) / dash.moisture.length).toFixed(1)}% при цел ${dash.moistureTarget}%\n`
				: `--- Operations dashboard (your local data) ---\nActive screen: ${pageTitle}\n${cropLine}\nField statuses: ${countsLine}\nCritical field IDs: ${dash.fields.filter(f => f.status === 'critical')
						.map(f => f.id)
						.join(', ')}\nAvg moisture (7d): ${(dash.moisture.reduce((s, x) => s + x, 0) / dash.moisture.length).toFixed(1)}% vs target ${dash.moistureTarget}%\n`;
		return `${hdr}${w ? `${w}\n` : ''}`;
	}, [lang, pageTitle, statusCounts, weatherSnap, dash]);

	const runRag = async () => {
		const q = ragQuestion.trim();
		if (!q || ragLoading) return;
		setRagError('');
		setRagLoading(true);
		try {
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					messages: [
						{
							role: 'user',
							content: `${q}\n\n${ragSnapshot()}`,
						},
					],
					locale: lang,
					persona: 'agronomist',
					dealContext: dashboardDealContext,
					farmerContext,
				}),
			});
			const data = (await res.json()) as { reply?: string; error?: string };
			if (!res.ok) throw new Error(data.error || 'RAG request failed');
			setRagAnswer((data.reply || '').trim());
		} catch (e) {
			setRagError(e instanceof Error ? e.message : 'RAG request failed');
		} finally {
			setRagLoading(false);
		}
	};

	useEffect(() => {
		const ac = new AbortController();
		const lat = dash.weatherLat;
		const lon = dash.weatherLon;

		if (!weatherCoordsRef.current) {
			weatherCoordsRef.current = { lat, lon };
		} else if (weatherCoordsRef.current.lat !== lat || weatherCoordsRef.current.lon !== lon) {
			weatherCoordsRef.current = { lat, lon };
			setWeatherSnap(null);
		}

		const showLoading = page === 'weather';
		if (showLoading) {
			setWeatherLoading(true);
			setWeatherErr('');
		}

		void (async () => {
			try {
				let res = await fetchFarmDashWeather(lat, lon, ac.signal);
				if (!res.ok && !ac.signal.aborted) {
					try {
						await abortableSleep(1200, ac.signal);
						res = await fetchFarmDashWeather(lat, lon, ac.signal);
					} catch (e: unknown) {
						if (ac.signal.aborted || (e instanceof DOMException && e.name === 'AbortError')) return;
						throw e;
					}
				}
				if (ac.signal.aborted) return;
				if (!res.ok) throw new Error(res.error);
				setWeatherSnap(res.snap);
				if (showLoading) setWeatherErr('');
			} catch (err: unknown) {
				if (ac.signal.aborted) return;
				const msg =
					err instanceof Error
						? err.message
						: lang === 'bg'
							? 'Грешка при зареждане. Проверете интернет и координатите.'
							: 'Load failed. Check network and coordinates.';
				if (showLoading) setWeatherErr(msg);
			} finally {
				if (!ac.signal.aborted && showLoading) setWeatherLoading(false);
			}
		})();

		return () => ac.abort();
	}, [page, weatherNonce, dash.weatherLat, dash.weatherLon, lang]);

	const refreshWeather = () => setWeatherNonce(n => n + 1);

	const exportDashboardJson = () => {
		try {
			const payload = JSON.stringify(dash, null, 2);
			const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
			const stamp = new Date().toISOString().slice(0, 10);
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `agrinexus-dashboard-export-${stamp}.json`;
			a.rel = 'noopener';
			document.body.appendChild(a);
			a.click();
			a.remove();
			window.setTimeout(() => URL.revokeObjectURL(url), 4000);
		} catch (e) {
			console.error(e);
			window.alert(pick('Експортът не бе успешен.', 'Export failed.'));
		}
	};

	const importDashboardFromFile = (e: ChangeEvent<HTMLInputElement>) => {
		const input = e.target;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		void file.text().then(text => {
			try {
				const parsed = JSON.parse(text) as unknown;
				const next = parseFarmDash(parsed);
				if (
					!window.confirm(
						pick(
							'Замяна на текущите данни за таблото със съдържанието на файла?',
							'Replace current dashboard data with this file?',
						),
					)
				)
					return;
				setDash(next);
				setWeatherNonce(n => n + 1);
			} catch {
				window.alert(
					pick(
						'Файлът не е валиден JSON или не отговаря на таблото.',
						'Invalid JSON or not a dashboard export.',
					),
				);
			}
		});
	};

	const downloadPdfReport = async () => {
		if (pdfBusy) return;
		setPdfBusy(true);
		try {
			let bytes: Uint8Array | null = null;
			let lastErr: unknown;
			for (let attempt = 0; attempt < 2; attempt += 1) {
				try {
					bytes = await buildFarmDashReportPdf({
						lang,
						dash,
						weather: weatherSnap,
					});
					break;
				} catch (e) {
					lastErr = e;
					if (attempt === 0) await new Promise(r => window.setTimeout(r, 800));
				}
			}
			if (!bytes) throw lastErr ?? new Error('PDF failed');
			const copy = Uint8Array.from(bytes);
			const blob = new Blob([copy], { type: 'application/pdf' });
			const stamp = new Date().toISOString().slice(0, 10);
			const name = `agrinexus-operations-${stamp}.pdf`;
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = name;
			a.rel = 'noopener';
			document.body.appendChild(a);
			a.click();
			a.remove();
			window.setTimeout(() => URL.revokeObjectURL(url), 4000);
		} catch (e) {
			console.error(e);
			window.alert(
				lang === 'bg'
					? 'Неуспешно генериране на PDF. Опитайте отново.'
					: 'Could not generate PDF. Please try again.',
			);
		} finally {
			setPdfBusy(false);
		}
	};

	const filteredFields = useMemo(() => {
		const q = fieldSearch.trim().toLowerCase();
		if (!q) return dash.fields;
		return dash.fields.filter(
			f =>
				String(f.id).includes(q) ||
				statusLabels[f.status].toLowerCase().includes(q),
		);
	}, [fieldSearch, statusLabels, dash.fields]);

	const harvestDataMain = useMemo(
		() => ({
			labels:
				lang === 'bg'
					? ['Апр', 'Май', 'Юни', 'Юли', 'Авг', 'Сеп', 'Окт']
					: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'],
			datasets: [
				{
					label: lang === 'bg' ? 'Пшеница' : 'Wheat',
					data: [...dash.harvestMonthly.wheat],
					backgroundColor: '#2a9d6e',
					borderRadius: 4,
				},
				{
					label: lang === 'bg' ? 'Царевица' : 'Maize',
					data: [...dash.harvestMonthly.maize],
					backgroundColor: '#3a86d4',
					borderRadius: 4,
				},
				{
					label: lang === 'bg' ? 'Слънчоглед' : 'Sunflower',
					data: [...dash.harvestMonthly.sunflower],
					backgroundColor: '#e8a020',
					borderRadius: 4,
				},
			],
		}),
		[lang, dash.harvestMonthly],
	);

	const cropPieData = useMemo(() => {
		const raw = dash.cropShares.map(v => Math.max(0, v));
		const sum = raw.reduce((s, x) => s + x, 0);
		const data = sum <= 0 ? [1, 1, 1, 1] : raw;
		return {
			labels:
				lang === 'bg'
					? ['Пшеница', 'Царевица', 'Слънчоглед', 'Рапица']
					: ['Wheat', 'Maize', 'Sunflower', 'Rapeseed'],
			datasets: [
				{
					data,
					backgroundColor: ['#2a9d6e', '#3a86d4', '#e8a020', '#c2527a'],
					borderWidth: 0,
					hoverOffset: 6,
				},
			],
		};
	}, [lang, dash.cropShares]);

	const moistureLabels =
		lang === 'bg' ? ['Пон', 'Вт', 'Ср', 'Чет', 'Пет', 'Сб', 'Нед'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

	const moistureData = useMemo(
		() => ({
			labels: moistureLabels,
			datasets: [
				{
					label: lang === 'bg' ? 'Влажност' : 'Moisture %',
					data: [...dash.moisture],
					borderColor: '#3a86d4',
					backgroundColor: 'rgba(58,134,212,0.08)',
					fill: true,
					tension: 0.4,
					pointRadius: 4,
					pointBackgroundColor: '#3a86d4',
				},
				{
					label: lang === 'bg' ? 'Оптимална' : 'Optimal',
					data: moistureLabels.map(() => dash.moistureTarget),
					borderColor: '#2a9d6e',
					borderDash: [5, 5],
					borderWidth: 1.5,
					pointRadius: 0,
					tension: 0,
				},
			],
		}),
		[lang, moistureLabels, dash.moisture, dash.moistureTarget],
	);

	const moistureChartOpts = useMemo<ChartOptions<'line'>>(() => {
		const vals = [...dash.moisture, dash.moistureTarget];
		const lo = Math.min(...vals);
		const hi = Math.max(...vals);
		const pad = 4;
		return {
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				legend: {
					labels: { font: chartFont, boxWidth: 12, usePointStyle: false },
				},
			},
			scales: {
				y: {
					min: Math.min(55, Math.floor(lo - pad)),
					max: Math.max(80, Math.ceil(hi + pad)),
					grid: { color: 'rgba(0,0,0,0.05)' },
					ticks: { font: chartFont },
				},
				x: {
					grid: { display: false },
					ticks: { font: chartFont },
				},
			},
		};
	}, [dash.moisture, dash.moistureTarget]);

	const cropPieOpts: ChartOptions<'doughnut'> = {
		responsive: true,
		maintainAspectRatio: false,
		cutout: '68%',
		plugins: { legend: { display: false } },
	};

	const agroTips = useMemo(() => {
		if (!weatherSnap?.daily?.precipitation_sum?.length) return [];
		const d = weatherSnap.daily;
		const maxRain = Math.max(...d.precipitation_sum.map(Number));
		const maxWind = Math.max(...d.wind_speed_10m_max.map(Number));
		const maxTemp = Math.max(...d.temperature_2m_max.map(Number));
		if (![maxRain, maxWind, maxTemp].every(Number.isFinite)) return [];
		type Tip = { cls: string; icon: string; title: string; text: string };
		const tips: Tip[] = [];
		if (maxRain > 10)
			tips.push({
				cls: 'warn',
				icon: '💧',
				title: lang === 'bg' ? 'Очакват се обилни валежи' : 'Heavy rain expected',
				text:
					lang === 'bg'
						? `Прогнозирани са до ${maxRain.toFixed(0)} мм валежи тази седмица. Препоръчваме да завършите напояването предварително.`
						: `Up to ${maxRain.toFixed(0)} mm rain this week. Consider finishing irrigation early.`,
			});
		if (maxWind > 30)
			tips.push({
				cls: 'warn',
				icon: '💨',
				title: lang === 'bg' ? 'Силен вятър — внимание' : 'Strong wind — caution',
				text:
					lang === 'bg'
						? `Очаква се вятър до ${maxWind.toFixed(0)} км/ч. Избягвайте пръскане с пестициди в такива дни.`
						: `Wind up to ${maxWind.toFixed(0)} km/h. Avoid spraying on those days.`,
			});
		if (maxTemp > 28)
			tips.push({
				cls: 'info',
				icon: '🌡️',
				title: lang === 'bg' ? 'Високи температури' : 'High temperatures',
				text:
					lang === 'bg'
						? `Максималната температура ще достигне ${maxTemp.toFixed(0)}°C. Напоявайте рано сутринта или вечерта.`
						: `Highs near ${maxTemp.toFixed(0)}°C. Irrigate early morning or evening.`,
			});
		tips.push({
			cls: 'ok',
			icon: '🌱',
			title: lang === 'bg' ? 'Актуална прогноза' : 'Live forecast',
			text:
				lang === 'bg'
					? `Данните са от Open-Meteo за зададените координати (${dash.weatherLat.toFixed(2)}, ${dash.weatherLon.toFixed(2)}) и се опресняват на фона и при отваряне на таба.`
					: `Data from Open-Meteo for your saved coordinates (${dash.weatherLat.toFixed(2)}, ${dash.weatherLon.toFixed(2)}); refreshes in the background and when you open this tab.`,
		});
		return tips;
	}, [weatherSnap, lang, dash.weatherLat, dash.weatherLon]);

	const daysBg = ['Нед', 'Пон', 'Вт', 'Ср', 'Чет', 'Пет', 'Сб'];
	const daysEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const dayNames = lang === 'bg' ? daysBg : daysEn;

	const harMonthLbl =
		lang === 'bg'
			? ['Апр', 'Май', 'Юни', 'Юли', 'Авг', 'Сеп', 'Окт']
			: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];

	const moistureAvg = (
		dash.moisture.reduce((s, x) => s + x, 0) / Math.max(1, dash.moisture.length)
	).toFixed(1);

	const resetLocalDashboard = () => {
		if (
			!window.confirm(
				pick(
					'Изтриване на всички запазени данни за таблото в този браузър?',
					'Clear all saved dashboard data in this browser?',
				),
			)
		)
			return;
		try {
			localStorage.removeItem(FARM_DASH_STORAGE_KEY);
		} catch {
			/* ignore */
		}
		setDash(defaultFarmDash());
		setWeatherSnap(null);
		setWeatherNonce(n => n + 1);
	};

	const cropLbl =
		lang === 'bg'
			? (['Пшеница', 'Царевица', 'Слънчоглед', 'Рапица'] as const)
			: (['Wheat', 'Maize', 'Sunflower', 'Rapeseed'] as const);

	return (
		<section className="section farm-dash-scope">
			<style>{`
				@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
				.farm-dash-scope {
					font-family: 'DM Sans', system-ui, sans-serif;
					color: #1a1a18;
					background: #f4f3ee;
					border-radius: 18px;
					padding: 16px;
					border: 1px solid rgba(0,0,0,.08);
				}
				.farm-dash-top {
					display: flex;
					flex-wrap: wrap;
					align-items: center;
					justify-content: space-between;
					gap: 12px;
					margin-bottom: 14px;
				}
				.farm-dash-nav {
					display: flex;
					flex-wrap: wrap;
					gap: 6px;
				}
				.farm-dash-nav .nav-item {
					border: 1px solid rgba(0,0,0,.12);
					background: #fff;
					color: #1a1a18;
					padding: 8px 12px;
					border-radius: 999px;
					font-weight: 600;
					font-size: 13px;
					cursor: pointer;
					transition: background .15s, color .15s, border-color .15s;
				}
				.farm-dash-nav .nav-item:hover {
					border-color: rgba(42,157,110,.45);
				}
				.farm-dash-nav .nav-item.active {
					background: #2a9d6e;
					color: #fff;
					border-color: #2a9d6e;
				}
				.farm-dash-top-actions {
					display: inline-flex;
					flex-wrap: wrap;
					align-items: center;
					gap: 8px;
				}
				.farm-dash-pdf-btn {
					display: inline-flex;
					align-items: center;
					gap: 6px;
					padding: 8px 12px;
					border-radius: 999px;
					border: 1px solid rgba(0,0,0,.12);
					background: #fff;
					font-size: 13px;
					font-weight: 700;
					cursor: pointer;
					color: #1a1a18;
				}
				.farm-dash-pdf-btn:hover:not(:disabled) {
					border-color: rgba(42,157,110,.45);
				}
				.farm-dash-pdf-btn:disabled {
					opacity: .55;
					cursor: not-allowed;
				}
				.farm-dash-weather-chip {
					display: inline-flex;
					align-items: center;
					gap: 8px;
					padding: 8px 12px;
					border-radius: 999px;
					background: #fff;
					border: 1px solid rgba(0,0,0,.1);
					font-size: 13px;
					font-weight: 600;
					color: #1a1a18;
				}
				/* Beat global .app / section text color so title stays dark on cream panel */
				main#main-content .farm-dash-scope.section h2.page-title {
					margin: 0 0 12px;
					font-size: 1.35rem;
					font-weight: 800;
					color: #121812;
					-webkit-text-fill-color: currentColor;
				}
				.farm-dash-hidden { display: none !important; }
				.farm-dash-grid-2 {
					display: grid;
					grid-template-columns: 1.2fr 1fr;
					gap: 14px;
				}
				@media (max-width: 1000px) {
					.farm-dash-grid-2 { grid-template-columns: 1fr; }
				}
				.farm-panel {
					background: #fff;
					border: 1px solid rgba(0,0,0,.08);
					border-radius: 14px;
					padding: 14px;
					box-shadow: 0 2px 10px rgba(0,0,0,.05);
				}
				.farm-panel h3 {
					margin: 0 0 10px;
					font-size: 14px;
					font-weight: 700;
				}
				#fieldMap, .field-map-grid {
					display: grid;
					grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
					gap: 8px;
				}
				.field-tile {
					border-radius: 10px;
					min-height: 72px;
					display: flex;
					flex-direction: column;
					align-items: center;
					justify-content: center;
					gap: 2px;
					cursor: default;
					color: #fff;
					font-weight: 700;
					border: 1px solid rgba(0,0,0,.06);
				}
				.field-tile .fnum { font-size: 15px; }
				.field-tile .flabel { font-size: 10px; opacity: .92; font-weight: 600; }
				.field-tile.s-great { background: #2a9d6e; }
				.field-tile.s-good { background: #4cb381; }
				.field-tile.s-warn { background: #e8a020; color: #1a1205; }
				.field-tile.s-critical { background: #d94040; }
				.field-tile.s-rest { background: #8b9dc9; color: #121822; }
				.chart-box { height: 260px; position: relative; }
				.chart-box.tall { height: 300px; }
				.forecast-row {
					display: flex;
					gap: 10px;
					flex-wrap: wrap;
					margin-top: 12px;
				}
				.forecast-day {
					flex: 1;
					min-width: 72px;
					text-align: center;
					padding: 10px 8px;
					border-radius: 12px;
					background: #f7f7f4;
					border: 1px solid rgba(0,0,0,.06);
				}
				.forecast-day.active {
					border-color: rgba(42,157,110,.5);
					box-shadow: 0 0 0 2px rgba(42,157,110,.15);
				}
				.fd-name { font-size: 11px; font-weight: 700; margin-bottom: 4px; }
				.fd-icon { font-size: 22px; margin: 4px 0; }
				.fd-hi { font-weight: 800; font-size: 14px; }
				.fd-lo { font-size: 12px; opacity: .65; }
				.fd-rain { font-size: 11px; margin-top: 4px; color: #3a86d4; }
				.w-grid {
					display: grid;
					grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
					gap: 10px;
				}
				.w-card {
					background: #f7f7f4;
					border-radius: 12px;
					padding: 10px;
					border: 1px solid rgba(0,0,0,.06);
				}
				.w-card strong { display: block; font-size: 11px; opacity: .65; margin-bottom: 4px; }
				.tip { display: flex; gap: 10px; padding: 10px; border-radius: 12px; margin-bottom: 8px; border: 1px solid rgba(0,0,0,.06); }
				.tip-warn { background: #fdf3e0; border-color: rgba(232,160,32,.35); }
				.tip-info { background: #e8f4fc; border-color: rgba(58,134,212,.25); }
				.tip-ok { background: #e8f7ef; border-color: rgba(42,157,110,.28); }
				.tip-title { font-weight: 800; font-size: 13px; }
				.tip-text { font-size: 12px; opacity: .88; margin-top: 2px; }
				.filter-btn {
					border: 1px solid rgba(0,0,0,.12);
					background: #fff;
					padding: 6px 12px;
					border-radius: 999px;
					font-weight: 700;
					font-size: 12px;
					cursor: pointer;
				}
				.filter-btn.active {
					background: #2a9d6e;
					color: #fff;
					border-color: #2a9d6e;
				}
				.alert-card {
					padding: 12px;
					border-radius: 12px;
					border: 1px solid rgba(0,0,0,.08);
					background: #fff;
					margin-bottom: 8px;
				}
				.alert-card.read { opacity: .55; }
				table.fields-table {
					width: 100%;
					border-collapse: collapse;
					font-size: 13px;
				}
				table.fields-table th, table.fields-table td {
					padding: 8px 10px;
					border-bottom: 1px solid rgba(0,0,0,.08);
					text-align: left;
				}
				.farm-dash-scope input[type="search"], .farm-dash-scope textarea {
					width: 100%;
					padding: 10px;
					border-radius: 10px;
					border: 1px solid rgba(0,0,0,.15);
					font-family: inherit;
				}
				.farm-dash-scope input.in-num {
					width: 100%;
					max-width: 76px;
					padding: 6px 8px;
					border-radius: 8px;
					border: 1px solid rgba(0,0,0,.15);
					font-family: inherit;
				}
				.farm-data-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 10px; }
				.farm-data-row label { font-size: 12px; font-weight: 700; min-width: 120px; }
				.farm-month-grid {
					display: grid;
					grid-template-columns: repeat(7, minmax(52px, 1fr));
					gap: 6px;
					align-items: end;
					margin-top: 8px;
				}
				.farm-month-grid span { font-size: 10px; font-weight: 700; text-align: center; opacity: .75; }
				.farm-dash-scope .rag-actions {
					display: flex;
					flex-wrap: wrap;
					gap: 8px;
					margin-top: 8px;
				}
				.farm-dash-scope .rag-actions button {
					border-radius: 999px;
					padding: 8px 14px;
					font-weight: 700;
					cursor: pointer;
					border: 1px solid rgba(0,0,0,.12);
					background: #fff;
				}
				.farm-dash-scope .rag-actions button.primary {
					background: #2a9d6e;
					color: #fff;
					border-color: #2a9d6e;
				}
			`}</style>

			<div className="farm-dash-top">
				<div className="farm-dash-nav" role="tablist">
					{( ['dashboard', 'fields', 'weather', 'harvest', 'alerts', 'settings'] as FarmPage[]).map(p => (
						<button
							key={p}
							type="button"
							className={`nav-item ${page === p ? 'active' : ''}`}
							onClick={() => setPage(p)}>
							{lang === 'bg' ? PAGE_TITLE_BG[p] : PAGE_TITLE_EN[p]}
						</button>
					))}
				</div>
				<div className="farm-dash-top-actions">
					<div className="farm-dash-weather-chip" aria-hidden={!weatherSnap}>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16">
							<circle cx="12" cy="12" r="4" />
							<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
						</svg>
						<span>
							{weatherSnap
								? `${Math.round(weatherSnap.temp)}°C · ${weatherDesc(weatherSnap.code, lang)}`
								: pick('Метео: —', 'Weather: —')}
						</span>
					</div>
					<button
						type="button"
						className="farm-dash-pdf-btn"
						onClick={() => void downloadPdfReport()}
						disabled={pdfBusy}>
						<FileDown size={16} aria-hidden />
						{pdfBusy
							? pick('PDF…', 'PDF…')
							: pick('Изтегли PDF', 'Download PDF')}
					</button>
				</div>
			</div>

			<h2 className="page-title">{pageTitle}</h2>

			<div id="page-dashboard" className={page === 'dashboard' ? '' : 'farm-dash-hidden'}>
				<p style={{ margin: '0 0 14px', fontSize: 13, opacity: 0.78, lineHeight: 1.45 }}>
					{pick(
						'Таблото работи с вашите данни: промените се запазват автоматично в браузъра (localStorage). Няма акаунт или облачен архив — преинсталация на браузъра или изчистване на данни може да ги изтрие; ползвайте експорт JSON от „Настройки“. Метео от Open-Meteo според координатите в „Настройки“, с фоново опресняване.',
						'This dashboard stores your data in the browser (localStorage). There is no account or cloud backup — reinstalling the browser or clearing site data may erase it; use JSON export under Settings. Weather comes from Open-Meteo for coordinates under Settings, with background refresh.',
					)}
				</p>
				<div className="farm-dash-grid-2">
					<div className="farm-panel">
						<h3>{pick('Мрежа полета', 'Field map')}</h3>
						<p style={{ fontSize: 12, opacity: 0.72, margin: '0 0 10px' }}>
							{pick('Статусите се редактират от таб „Полета“.', 'Edit statuses under the Fields tab.')}
						</p>
						<div id="fieldMap" className="field-map-grid">
							{dash.fields.map(f => (
								<div
									key={f.id}
									className={`field-tile s-${f.status}`}
									title={`${pick('Поле', 'Field')} ${f.id} — ${statusLabels[f.status]}`}>
									<span className="fnum">{f.id}</span>
									<span className="flabel">
										{pick('Поле', 'Field')} {f.id}
									</span>
								</div>
							))}
						</div>
					</div>
					<div className="farm-panel">
						<h3>{pick('Дялове култури', 'Crop shares')}</h3>
						<div className="chart-box">
							<Doughnut data={cropPieData} options={cropPieOpts} />
						</div>
					</div>
				</div>
				<div className="farm-dash-grid-2" style={{ marginTop: 14 }}>
					<div className="farm-panel">
						<h3>{pick('Реколта по месеци (т) — вашите серии', 'Harvest by month (t) — your series')}</h3>
						<div className="chart-box tall">
							<Bar data={harvestDataMain} options={dashboardHarvestOpts} />
						</div>
					</div>
					<div className="farm-panel">
						<h3>{pick('Влажност на почвата (%)', 'Soil moisture (%)')}</h3>
						<div className="chart-box tall">
							<Line data={moistureData} options={moistureChartOpts} />
						</div>
					</div>
				</div>
			</div>

			<div id="page-fields" className={page === 'fields' ? '' : 'farm-dash-hidden'}>
				<div className="farm-panel">
					<input
						id="fieldSearch"
						type="search"
						placeholder={pick('Търсене по номер или статус…', 'Search by number or status…')}
						value={fieldSearch}
						onChange={e => setFieldSearch(e.target.value)}
					/>
					<table className="fields-table" id="fieldsTable">
						<thead>
							<tr>
								<th>#</th>
								<th>{pick('Статус', 'Status')}</th>
							</tr>
						</thead>
						<tbody>
							{filteredFields.map(f => (
								<tr key={f.id}>
									<td>{pick('Поле', 'Field')} {f.id}</td>
									<td>
										<select
											value={f.status}
											onChange={e => {
												const st = e.target.value as FieldTileStatus;
												setDash(prev => ({
													...prev,
													fields: prev.fields.map(row =>
														row.id === f.id ? { ...row, status: st } : row,
													),
												}));
											}}
											style={{
												padding: '6px 8px',
												borderRadius: 8,
												border: '1px solid rgba(0,0,0,.15)',
												fontFamily: 'inherit',
												width: '100%',
												maxWidth: 200,
											}}>
											{(Object.keys(statusLabels) as FieldTileStatus[]).map(key => (
												<option key={key} value={key}>
													{statusLabels[key]}
												</option>
											))}
										</select>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>

			<div id="page-weather" className={page === 'weather' ? '' : 'farm-dash-hidden'}>
				<div className="farm-panel">
					<div
						style={{
							display: 'flex',
							flexWrap: 'wrap',
							gap: 10,
							alignItems: 'center',
							marginBottom: 12,
						}}>
						<button
							type="button"
							className="filter-btn"
							disabled={weatherLoading}
							onClick={() => refreshWeather()}>
							{pick('Обнови метео', 'Refresh weather')}
						</button>
						<span style={{ fontSize: 12, opacity: 0.75 }}>
							{pick('Координати (Настройки):', 'Coordinates (Settings):')} {dash.weatherLat.toFixed(4)},{' '}
							{dash.weatherLon.toFixed(4)}
						</span>
					</div>
					{weatherLoading ? (
						<p>{pick('Зареждане…', 'Loading…')}</p>
					) : weatherErr ? (
						<p style={{ color: '#b91c1c' }}>{weatherErr}</p>
					) : weatherSnap ? (
						<>
							<div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
								<span id="w-icon" style={{ fontSize: 42 }}>
									{weatherIcon(weatherSnap.code)}
								</span>
								<div>
									<div id="w-temp" style={{ fontSize: 32, fontWeight: 800 }}>
										{Math.round(weatherSnap.temp)}°C
									</div>
									<div id="w-desc" className="muted" style={{ fontSize: 13 }}>
										{weatherDesc(weatherSnap.code, lang)}
										{' · '}
										{pick('Вятър', 'Wind')} {Math.round(weatherSnap.wind)}{' '}
										{pick('км/ч', 'km/h')}
									</div>
								</div>
							</div>
							<div className="w-grid">
								<div className="w-card">
									<strong>{pick('Усеща се', 'Feels')}</strong>
									<span id="w-feels">{Math.round(weatherSnap.feels)}°C</span>
								</div>
								<div className="w-card">
									<strong>{pick('Влажност', 'Humidity')}</strong>
									<span id="w-humidity">{weatherSnap.humidity}%</span>
								</div>
								<div className="w-card">
									<strong>{pick('Вятър', 'Wind')}</strong>
									<span id="w-wind">{Math.round(weatherSnap.wind)} km/h</span>
								</div>
								<div className="w-card">
									<strong>{pick('Налягане', 'Pressure')}</strong>
									<span id="w-pressure">{Math.round(weatherSnap.pressure)} hPa</span>
								</div>
								<div className="w-card">
									<strong>{pick('Валеж', 'Rain')}</strong>
									<span id="w-rain">{weatherSnap.rain.toFixed(1)} mm</span>
								</div>
								<div className="w-card">
									<strong>UV</strong>
									<span id="w-uv">{weatherSnap.uv.toFixed(1)}</span>
								</div>
							</div>

							{weatherSnap.daily ? (
								<div id="forecast-row" className="forecast-row">
									{weatherSnap.daily.time.map((dateStr, i) => {
										const date = new Date(dateStr);
										const dayName =
											i === 0
												? pick('Днес', 'Today')
												: dayNames[date.getDay()];
										const rain = weatherSnap.daily!.precipitation_sum[i];
										return (
											<div key={dateStr} className={`forecast-day ${i === 0 ? 'active' : ''}`}>
												<div className="fd-name">{dayName}</div>
												<div className="fd-icon">{weatherIcon(weatherSnap.daily!.weather_code[i])}</div>
												<div className="fd-hi">{Math.round(weatherSnap.daily!.temperature_2m_max[i])}°</div>
												<div className="fd-lo">{Math.round(weatherSnap.daily!.temperature_2m_min[i])}°</div>
												<div className="fd-rain">{Number(rain).toFixed(1)} mm</div>
											</div>
										);
									})}
								</div>
							) : null}

							<div id="agro-tips" style={{ marginTop: 14 }}>
								{agroTips.map((t, idx) => (
									<div key={idx} className={`tip tip-${t.cls}`}>
										<div className="tip-icon">{t.icon}</div>
										<div>
											<div className="tip-title">{t.title}</div>
											<div className="tip-text">{t.text}</div>
										</div>
									</div>
								))}
							</div>

							{weatherSnap.daily ? (
								<div className="farm-dash-grid-2" style={{ marginTop: 14 }}>
									<div className="farm-panel">
										<h3>{pick('Температура 7 дни', '7-day temperature')}</h3>
										<div className="chart-box tall">
											<Line
												data={{
													labels: weatherSnap.daily.time.map((dt, i) =>
														i === 0 ? pick('Днес', 'Today') : dayNames[new Date(dt).getDay()],
													),
													datasets: [
														{
															label: pick('Макс °C', 'Max °C'),
															data: weatherSnap.daily.temperature_2m_max.map(v => Math.round(v)),
															borderColor: '#e8a020',
															backgroundColor: 'rgba(232,160,32,0.1)',
															fill: false,
															tension: 0.4,
															pointRadius: 5,
															pointBackgroundColor: '#e8a020',
														},
														{
															label: pick('Мин °C', 'Min °C'),
															data: weatherSnap.daily.temperature_2m_min.map(v => Math.round(v)),
															borderColor: '#3a86d4',
															backgroundColor: 'rgba(58,134,212,0.08)',
															fill: '-1',
															tension: 0.4,
															pointRadius: 5,
															pointBackgroundColor: '#3a86d4',
														},
													],
												}}
												options={{
													responsive: true,
													maintainAspectRatio: false,
													plugins: {
														legend: { labels: { font: chartFont, boxWidth: 12 } },
													},
													scales: {
														y: {
															grid: { color: 'rgba(0,0,0,0.05)' },
															ticks: {
																font: chartFont,
																callback: (v: string | number) => `${v}°`,
															},
														},
														x: {
															grid: { display: false },
															ticks: { font: chartFont },
														},
													},
												}}
											/>
										</div>
									</div>
									<div className="farm-panel">
										<h3>{pick('Валежи (мм)', 'Rain (mm)')}</h3>
										<div className="chart-box tall">
											<Bar
												data={{
													labels: weatherSnap.daily.time.map((dt, i) =>
														i === 0 ? pick('Днес', 'Today') : dayNames[new Date(dt).getDay()],
													),
													datasets: [
														{
															label: pick('Валежи', 'Rain'),
															data: weatherSnap.daily.precipitation_sum.map(v => +Number(v).toFixed(1)),
															backgroundColor: (ctx: ScriptableContext<'bar'>) => {
																const y = ctx.parsed?.y;
																const v = typeof y === 'number' ? y : 0;
																return v >= 10 ? '#d94040' : v > 0 ? '#3a86d4' : '#e0ede8';
															},
															borderRadius: 4,
														},
													],
												}}
												options={{
													responsive: true,
													maintainAspectRatio: false,
													plugins: { legend: { display: false } },
													scales: {
														y: {
															grid: { color: 'rgba(0,0,0,0.05)' },
															ticks: {
																font: chartFont,
																callback: (v: string | number) => `${v} mm`,
															},
														},
														x: {
															grid: { display: false },
															ticks: { font: chartFont },
														},
													},
												}}
											/>
										</div>
									</div>
								</div>
							) : null}
						</>
					) : null}
				</div>
			</div>

			<div id="page-harvest" className={page === 'harvest' ? '' : 'farm-dash-hidden'}>
				<div className="farm-panel">
					<h3>{pick('Реколта по години', 'Harvest by year')}</h3>
					<div className="chart-box tall">
						<Bar
							data={{
								labels:
									lang === 'bg'
										? ['Пшеница', 'Царевица', 'Слънчоглед', 'Рапица']
										: ['Wheat', 'Maize', 'Sunflower', 'Rapeseed'],
								datasets: [
									{
										label: '2026',
										data: [...dash.harvestYears.y2026],
										backgroundColor: '#2a9d6e',
										borderRadius: 4,
									},
									{
										label: '2025',
										data: [...dash.harvestYears.y2025],
										backgroundColor: '#3a86d4',
										borderRadius: 4,
									},
									{
										label: '2024',
										data: [...dash.harvestYears.y2024],
										backgroundColor: '#e8a020',
										borderRadius: 4,
									},
								],
							}}
							options={{
								responsive: true,
								maintainAspectRatio: false,
								plugins: { legend: { labels: { font: chartFont, boxWidth: 12 } } },
								scales: {
									x: { grid: { display: false }, ticks: { font: chartFont } },
									y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: chartFont } },
								},
							}}
						/>
					</div>
				</div>
				<div className="farm-dash-grid-2" style={{ marginTop: 14 }}>
					<div className="farm-panel">
						<h3>{pick('Топ полета по реколта', 'Top fields by harvest')}</h3>
						<div className="chart-box tall">
							<Bar
								data={{
									labels:
										lang === 'bg'
											? ['Поле 3', 'Поле 8', 'Поле 1', 'Поле 6', 'Поле 2']
											: ['Field 3', 'Field 8', 'Field 1', 'Field 6', 'Field 2'],
									datasets: [
										{
											label: pick('Реколта (т)', 'Harvest (t)'),
											data: [...dash.topFields],
											backgroundColor: '#2a9d6e',
											borderRadius: 4,
										},
									],
								}}
								options={{
									indexAxis: 'y',
									responsive: true,
									maintainAspectRatio: false,
									plugins: { legend: { display: false } },
									scales: {
										x: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: chartFont } },
										y: { grid: { display: false }, ticks: { font: chartFont } },
									},
								}}
							/>
						</div>
					</div>
					<div className="farm-panel">
						<h3>{pick('Общо по месеци', 'Monthly totals')}</h3>
						<div className="chart-box tall">
							<Line
								data={{
									labels:
										lang === 'bg'
											? ['Апр', 'Май', 'Юни', 'Юли', 'Авг', 'Сеп', 'Окт']
											: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'],
									datasets: [
										{
											label: pick('Общо (т)', 'Total (t)'),
											data: [...dash.harvestTrend],
											borderColor: '#2a9d6e',
											backgroundColor: 'rgba(42,157,110,0.08)',
											fill: true,
											tension: 0.4,
											pointRadius: 4,
											pointBackgroundColor: '#2a9d6e',
										},
									],
								}}
								options={{
									responsive: true,
									maintainAspectRatio: false,
									plugins: { legend: { display: false } },
									scales: {
										x: { grid: { display: false }, ticks: { font: chartFont } },
										y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: chartFont } },
									},
								}}
							/>
						</div>
					</div>
				</div>
			</div>

			<div id="page-alerts" className={page === 'alerts' ? '' : 'farm-dash-hidden'}>
				<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
					{(['all', 'risk', 'wind', 'water'] as const).map(f => (
						<button
							key={f}
							type="button"
							className={`filter-btn ${alertFilter === f ? 'active' : ''}`}
							onClick={() => setAlertFilter(f)}>
							{f === 'all'
								? pick('Всички', 'All')
								: f === 'risk'
									? pick('Риск', 'Risk')
									: f === 'wind'
										? pick('Вятър', 'Wind')
										: pick('Вода', 'Water')}
						</button>
					))}
					<button type="button" className="filter-btn" onClick={() => setAlertsMarkRead(true)}>
						{pick('Маркирай прочетени', 'Mark all read')}
					</button>
				</div>
				{(
					[
						{
							type: 'risk' as const,
							title: pick('Нисък NDVI зона Поле 7', 'Low NDVI on field 7'),
							body: pick(
								'Препоръка: прегледайте напояването и торенето според почвения анализ.',
								'Review irrigation and nutrition based on soil assessment.',
							),
						},
						{
							type: 'wind' as const,
							title: pick('Силен вятър — отложете пръскане', 'High winds — delay spraying'),
							body: pick(
								'Очакван вятър над прага за безопасно пръскане в следващите 48 ч.',
								'Wind above safe spraying threshold in the next 48h.',
							),
						},
						{
							type: 'water' as const,
							title: pick('Влажност спрямо целта', 'Moisture vs target'),
							body: pick(
								`Вашите данни: средна влажност ${moistureAvg}% при цел ${dash.moistureTarget}%.`,
								`Your data: avg moisture ${moistureAvg}% vs target ${dash.moistureTarget}%.`,
							),
						},
					] as const
				).map((a, i) => (
					<div
						key={i}
						className={`alert-card${alertsMarkRead ? ' read' : ''}`}
						data-type={a.type}
						style={{
							display: alertFilter === 'all' || alertFilter === a.type ? '' : 'none',
						}}>
						<strong>{a.title}</strong>
						<p style={{ margin: '6px 0 0', fontSize: 13, opacity: 0.85 }}>{a.body}</p>
					</div>
				))}
			</div>

			<div id="page-settings" className={page === 'settings' ? '' : 'farm-dash-hidden'}>
				<div className="farm-panel">
					<h3>{pick('Бързи връзки', 'Quick links')}</h3>
					<p style={{ fontSize: 13, opacity: 0.85, marginTop: 0 }}>
						{pick(
							'Отворете основните модули на AgriNexus оттук.',
							'Open core AgriNexus modules from here.',
						)}
					</p>
					<div className="rag-actions">
						<button type="button" className="primary" onClick={() => onNavigate('assistant')}>
							{tr.navAssistant}
						</button>
						<button type="button" onClick={() => onNavigate('field-watch')}>
							{tr.fieldWatchPageTitle}
						</button>
						<button type="button" onClick={() => onNavigate('weather')}>
							{tr.navMeteoPdf}
						</button>
						<button type="button" onClick={() => onNavigate('command')}>
							{pick('Команден център', 'Command centre')}
						</button>
					</div>
				</div>

				<div className="farm-panel" style={{ marginTop: 14 }}>
					<h3>{pick('Вашите данни за таблото', 'Your dashboard data')}</h3>
					<p style={{ fontSize: 12, opacity: 0.78, marginTop: 0 }}>
						{pick(
							'Попълнете числата — графиките и RAG snapshot се обновяват автоматично. Запазване: ~0,4 с след промяна. Експортът/импортът на JSON е резервно копие на същите данни (localStorage).',
							'Enter numbers — charts and RAG snapshot update automatically. Saves ~0.4s after edits. JSON export/import backs up the same data as localStorage.',
						)}
					</p>

					<div className="farm-data-row">
						<label>{pick('Географска ширина', 'Latitude')}</label>
						<input
							className="in-num"
							style={{ maxWidth: 120 }}
							type="number"
							step="0.0001"
							value={dash.weatherLat}
							onChange={e => {
								const v = parseFloat(e.target.value);
								setDash(prev => ({
									...prev,
									weatherLat: Number.isFinite(v) ? Math.min(90, Math.max(-90, v)) : prev.weatherLat,
								}));
							}}
						/>
						<label>{pick('Географска дължина', 'Longitude')}</label>
						<input
							className="in-num"
							style={{ maxWidth: 120 }}
							type="number"
							step="0.0001"
							value={dash.weatherLon}
							onChange={e => {
								const v = parseFloat(e.target.value);
								setDash(prev => ({
									...prev,
									weatherLon: Number.isFinite(v) ? Math.min(180, Math.max(-180, v)) : prev.weatherLon,
								}));
							}}
						/>
					</div>

					<p style={{ fontSize: 12, fontWeight: 700, margin: '14px 0 6px' }}>
						{pick('Дялове култури (относителни)', 'Crop shares (relative weights)')}
					</p>
					<div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
						{dash.cropShares.map((val, i) => (
							<label key={i} style={{ fontSize: 12 }}>
								{cropLbl[i]}
								<input
									className="in-num"
									type="number"
									min={0}
									step={1}
									value={val}
									onChange={e => {
										const v = parseFloat(e.target.value);
										setDash(prev => ({
											...prev,
											cropShares: prev.cropShares.map((x, j) =>
												j === i ? (Number.isFinite(v) ? Math.max(0, v) : x) : x,
											),
										}));
									}}
									style={{ display: 'block', marginTop: 4 }}
								/>
							</label>
						))}
					</div>

					<p style={{ fontSize: 12, fontWeight: 700, margin: '14px 0 6px' }}>
						{pick('Влажност (7 дни) и целева линия', 'Moisture (7 days) and target line')}
					</p>
					<div className="farm-data-row">
						<label>{pick('Цел %', 'Target %')}</label>
						<input
							className="in-num"
							type="number"
							step={1}
							value={dash.moistureTarget}
							onChange={e => {
								const v = parseFloat(e.target.value);
								setDash(prev => ({
									...prev,
									moistureTarget: Number.isFinite(v) ? v : prev.moistureTarget,
								}));
							}}
						/>
					</div>
					<div className="farm-month-grid">
						{moistureLabels.map((lbl, i) => (
							<span key={`mo-${i}`}>{lbl}</span>
						))}
						{dash.moisture.map((val, i) => (
							<input
								key={i}
								className="in-num"
								style={{ maxWidth: '100%' }}
								type="number"
								step={1}
								value={val}
								onChange={e => {
									const v = parseFloat(e.target.value);
									setDash(prev => ({
										...prev,
										moisture: prev.moisture.map((x, j) =>
											j === i ? (Number.isFinite(v) ? v : x) : x,
										),
									}));
								}}
							/>
						))}
					</div>

					<p style={{ fontSize: 12, fontWeight: 700, margin: '14px 0 6px' }}>
						{pick('Реколта по месеци (тонове) — Пшеница / Царевица / Слънчоглед', 'Monthly harvest (t) — Wheat / Maize / Sunflower')}
					</p>
					{(['wheat', 'maize', 'sunflower'] as const).map(crop => (
						<div key={crop} style={{ marginBottom: 12 }}>
							<div style={{ fontSize: 11, fontWeight: 800, marginBottom: 4 }}>
								{crop === 'wheat'
									? pick('Пшеница', 'Wheat')
									: crop === 'maize'
										? pick('Царевица', 'Maize')
										: pick('Слънчоглед', 'Sunflower')}
							</div>
							<div className="farm-month-grid">
								{harMonthLbl.map((l, mi) => (
									<span key={`hm-${crop}-${mi}`}>{l}</span>
								))}
								{dash.harvestMonthly[crop].map((val, i) => (
									<input
										key={i}
										className="in-num"
										style={{ maxWidth: '100%' }}
										type="number"
										min={0}
										step={1}
										value={val}
										onChange={e => {
											const v = parseFloat(e.target.value);
											setDash(prev => ({
												...prev,
												harvestMonthly: {
													...prev.harvestMonthly,
													[crop]: prev.harvestMonthly[crop].map((x, j) =>
														j === i ? (Number.isFinite(v) ? Math.max(0, v) : x) : x,
													),
												},
											}));
										}}
									/>
								))}
							</div>
						</div>
					))}

					<p style={{ fontSize: 12, fontWeight: 700, margin: '14px 0 6px' }}>
						{pick('Реколта по години (таб „Реколта“) — редове 2026 / 2025 / 2024', 'Harvest-by-year tab — rows 2026 / 2025 / 2024')}
					</p>
					{(['y2026', 'y2025', 'y2024'] as const).map((yr, ri) => (
						<div key={yr} className="farm-data-row" style={{ alignItems: 'flex-end' }}>
							<label>{ri === 0 ? '2026' : ri === 1 ? '2025' : '2024'}</label>
							{dash.harvestYears[yr].map((val, i) => (
								<input
									key={i}
									className="in-num"
									type="number"
									min={0}
									step={10}
									value={val}
									title={cropLbl[i]}
									onChange={e => {
										const v = parseFloat(e.target.value);
										setDash(prev => ({
											...prev,
											harvestYears: {
												...prev.harvestYears,
												[yr]: prev.harvestYears[yr].map((x, j) =>
													j === i ? (Number.isFinite(v) ? Math.max(0, v) : x) : x,
												),
											},
										}));
									}}
								/>
							))}
						</div>
					))}

					<p style={{ fontSize: 12, fontWeight: 700, margin: '14px 0 6px' }}>
						{pick('Топ полета (тонове), 5 стойности', 'Top fields (t), five values')}
					</p>
					<div className="farm-data-row">
						{dash.topFields.map((val, i) => (
							<input
								key={i}
								className="in-num"
								type="number"
								min={0}
								step={10}
								value={val}
								onChange={e => {
									const v = parseFloat(e.target.value);
									setDash(prev => ({
										...prev,
										topFields: prev.topFields.map((x, j) =>
											j === i ? (Number.isFinite(v) ? Math.max(0, v) : x) : x,
										),
									}));
								}}
							/>
						))}
					</div>

					<p style={{ fontSize: 12, fontWeight: 700, margin: '14px 0 6px' }}>
						{pick('Общо реколта по месеци (линиен график)', 'Monthly total harvest (line chart)')}
					</p>
					<div className="farm-month-grid">
						{harMonthLbl.map((l, ti) => (
							<span key={`ht-${ti}`}>{l}</span>
						))}
						{dash.harvestTrend.map((val, i) => (
							<input
								key={i}
								className="in-num"
								style={{ maxWidth: '100%' }}
								type="number"
								min={0}
								step={10}
								value={val}
								onChange={e => {
									const v = parseFloat(e.target.value);
									setDash(prev => ({
										...prev,
										harvestTrend: prev.harvestTrend.map((x, j) =>
											j === i ? (Number.isFinite(v) ? Math.max(0, v) : x) : x,
										),
									}));
								}}
							/>
						))}
					</div>

					<input
						ref={dashImportRef}
						type="file"
						accept="application/json,.json"
						className="farm-dash-hidden"
						aria-hidden
						onChange={importDashboardFromFile}
					/>
					<div className="rag-actions" style={{ marginTop: 16 }}>
						<button type="button" onClick={exportDashboardJson}>
							{pick('Експорт JSON', 'Export JSON')}
						</button>
						<button type="button" onClick={() => dashImportRef.current?.click()}>
							{pick('Импорт JSON', 'Import JSON')}
						</button>
						<button type="button" className="primary" onClick={resetLocalDashboard}>
							{pick('Нулирай към начални стойности', 'Reset to defaults')}
						</button>
					</div>
				</div>
			</div>

			<div className="farm-panel" style={{ marginTop: 16 }}>
				<h3>{pick('RAG асистент (агроном)', 'RAG assistant (agronomist)')}</h3>
				<p style={{ fontSize: 12, opacity: 0.75, marginTop: 0 }}>
					{pick(
						'Заявката отива към /api/chat с persona agronomist, dealContext за таблото и farmer snapshot — ползва се retrieval от индекса, ако е конфигуриран.',
						'Requests go to /api/chat with agronomist persona, dashboard deal context and farmer snapshot — uses retrieval when configured.',
					)}
				</p>
				<textarea
					rows={4}
					placeholder={pick(
						'Напр. Дай 3 действия за полетата с „Внимание“ и „Критичен“ тази седмица.',
						'e.g. Give 3 actions for Warning and Critical fields this week.',
					)}
					value={ragQuestion}
					onChange={e => setRagQuestion(e.target.value)}
				/>
				<div className="rag-actions">
					<button type="button" className="primary" disabled={ragLoading} onClick={() => void runRag()}>
						{ragLoading ? pick('Генерирам…', 'Generating…') : pick('RAG препоръка', 'RAG recommendation')}
					</button>
					<button type="button" onClick={() => onNavigate('assistant')}>
						{tr.opsLinkAssistant}
					</button>
				</div>
				{ragError ? <p style={{ color: '#b91c1c', fontSize: 13 }}>{ragError}</p> : null}
				{ragAnswer ? (
					<div
						style={{
							marginTop: 10,
							background: '#f7f7f4',
							borderRadius: 10,
							padding: 12,
							whiteSpace: 'pre-wrap',
							fontSize: 13,
							border: '1px solid rgba(0,0,0,.08)',
						}}>
						{ragAnswer}
					</div>
				) : null}
			</div>
		</section>
	);
}

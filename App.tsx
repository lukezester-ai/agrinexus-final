import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Lucide from 'lucide-react';
import FileUploadPanel from './FileUploadPanel';
import { AppNavigation } from './components/AppNavigation';
import { MobileNavigation } from './components/MobileNavigation';
import './styles/app.css';
import {
	getDecisionBySignals,
	getVolatility,
	mergeLiveIntoDeals,
	safeLocalGet,
	safeLocalSet,
	safeSessionGet,
	safeSessionRemove,
	safeSessionSet,
} from './lib/appHelpers';
import type {
	ChatTurn,
	ClientProfile,
	DealCategoryFilter,
	DealRow,
	Lang,
	MarketQuotesApi,
	SearchableDeal,
	View,
	WatchlistPanel,
} from './lib/appTypes';
const {
	Leaf,
	Search,
	Lock,
	RefreshCw,
	CreditCard,
	Bell,
	Brain,
	LineChart,
	Mail,
	Building2,
	Globe2,
	Loader2,
	MessageSquare,
	Send,
	ArrowLeft,
} = Lucide;

/** Guest users see full detail for this many marketplace rows before soft-lock teasers. */
const FREE_MARKET_DEALS_FOR_GUEST = 18;

const PREVIEW_DEALS = [
	{
		id: 'p1',
		product: 'Peeled Tomatoes',
		packaging: '400g Tin Can',
		certification: 'HALAL, ISO',
		from: 'Bulgaria',
		to: 'Dubai, UAE',
		flag: '🇦🇪',
		profit: 22,
		price: '1.84 AED',
		isMENA: true,
	},
	{
		id: 'p2',
		product: 'Wheat (Premium)',
		packaging: 'Bulk (Silo)',
		certification: 'SGS Inspection',
		from: 'Romania',
		to: 'Berlin, Germany',
		flag: '🇩🇪',
		profit: 14,
		price: '0.43 EUR',
		isMENA: false,
	},
	{
		id: 'p3',
		product: 'Rose Jam',
		packaging: '380g Luxury Glass',
		certification: 'HALAL, Export',
		from: 'Greece',
		to: 'Cairo, Egypt',
		flag: '🇪🇬',
		profit: 27,
		price: '55.90 EGP',
		isMENA: true,
	},
	{
		id: 'p4',
		product: 'Tomato Paste',
		packaging: '70g Sachet / 24pcs',
		certification: 'HALAL, Saber',
		from: 'Turkey',
		to: 'Riyadh, KSA',
		flag: '🇸🇦',
		profit: 21,
		price: '2.10 SAR',
		isMENA: true,
	},
];

const AI_FEATURES = [
	{
		icon: Brain,
		title: 'BUY / HOLD / AVOID',
		text: 'AI trade logic ranks deals from your filters and illustrative scenarios — ready to plug in exchange feeds when connected.',
	},
	{
		icon: LineChart,
		title: 'Predictive Pricing',
		text: 'Forecasts future pricing and expected margin before deal execution.',
	},
	{
		icon: Bell,
		title: 'Smart Alerts',
		text: 'Email and Telegram-ready notifications for high-margin opportunities.',
	},
];

const PRODUCT_BG_ALIASES: Record<string, string[]> = {
	'Wheat (Premium)': ['пшеница', 'премиум пшеница', 'зърно'],
	Corn: ['царевица', 'зърно'],
	Barley: ['ечемик', 'зърно'],
	'Sunflower Seed': ['слънчогледово семе', 'слънчоглед'],
	Rapeseed: ['рапица'],
	Chickpeas: ['нахут'],
	Lentils: ['леща'],
	'Tomato Paste': ['доматено пюре'],
	'Peeled Tomatoes': ['белени домати'],
	'Sunflower Oil': ['слънчогледово масло'],
};

const CATEGORY_BG_ALIASES: Record<DealRow['category'], string[]> = {
	Grains: ['зърнени', 'зърно'],
	Oilseeds: ['маслодайни'],
	Pulses: ['бобови'],
	'Processed Foods': ['преработени', 'преработени храни'],
};

const MARKET_FLASH_EN = [
	'Illustrative: tomato paste corridor TR → KSA with tighter spreads in this demo scenario.',
	'Illustrative: sunflower oil bids from Egypt stay strong for the next loading windows in the demo set.',
	'Illustrative: premium wheat routes into the EU skew HOLD due to freight pressure in the demo narrative.',
];

const MARKET_FLASH_BG = [
	'Илюстративно: коридор доматено пюре TR → KSA с по-тесни спредове в демо сценария.',
	'Илюстративно: оферти за слънчогледово масло от Египет остават силни за следващите прозорци за товарене (демо).',
	'Илюстративно: премиум пшенични маршрути към EU — склонност към HOLD заради натиск върху превоза (демо).',
];

const QUICK_PROMPTS_BG = [
	'Дай BUY/HOLD/AVOID за домати България → UAE.',
	'Кои сертификати са критични за export към KSA?',
	'Бърз risk-check за EU → MENA маршрут.',
];

const QUICK_PROMPTS_EN = [
	'Give BUY/HOLD/AVOID for tomatoes Bulgaria → UAE.',
	'Which certifications matter most for export to KSA?',
	'Quick risk-check for EU → MENA route.',
];

const CLIENT_PROFILES: ClientProfile[] = [
	{
		id: 'c-101',
		company: 'Nile Harvest Foods',
		contactPerson: 'Omar Hassan',
		role: 'Procurement Director',
		email: 'omar@nileharvest.example',
		phone: '+20 100 221 884',
		region: 'Egypt (Cairo / Alexandria)',
		focus: 'Tomato products, sunflower oil',
		certifications: ['HALAL', 'ISO 22000'],
		preferredIncoterms: ['FOB', 'CIF'],
		monthlyVolume: '420 tons',
		creditStatus: 'Approved',
		notes: 'High demand before Ramadan period. Prefers stable monthly pricing windows.',
	},
	{
		id: 'c-102',
		company: 'Desert Gate Trading',
		contactPerson: 'Maha Al-Saud',
		role: 'Category Manager',
		email: 'maha@desertgate.example',
		phone: '+966 53 882 199',
		region: 'Saudi Arabia (Riyadh / Jeddah)',
		focus: 'Tomato paste sachets, pulses',
		certifications: ['HALAL', 'Saber', 'SGS'],
		preferredIncoterms: ['CIF', 'DAP'],
		monthlyVolume: '290 tons',
		creditStatus: 'Pending',
		notes: 'Requires fast certificate validation and strict shipment timeline.',
	},
	{
		id: 'c-103',
		company: 'EuroAgri Distribution',
		contactPerson: 'Elena Novak',
		role: 'Import Lead',
		email: 'elena@euroagri.example',
		phone: '+49 151 702 611',
		region: 'Germany / Netherlands',
		focus: 'Premium wheat, barley',
		certifications: ['SGS Inspection', 'Phytosanitary'],
		preferredIncoterms: ['FCA', 'FOB'],
		monthlyVolume: '680 tons',
		creditStatus: 'Review',
		notes: 'Margin sensitive. Prefers split contracts with weekly pricing review.',
	},
];

const CLIENT_PROFILE_BG_COPY: Record<
	ClientProfile['id'],
	{
		role: string;
		region: string;
		focus: string;
		monthlyVolume: string;
		notes: string;
	}
> = {
	'c-101': {
		role: 'Директор снабдяване',
		region: 'Египет (Кайро / Александрия)',
		focus: 'Доматени продукти, слънчогледово масло',
		monthlyVolume: '420 тона',
		notes:
			'Високо търсене преди периода Рамадан. Предпочита стабилни месечни ценови прозорци.',
	},
	'c-102': {
		role: 'Категориен мениджър',
		region: 'Саудитска Арабия (Рияд / Джеда)',
		focus: 'Сашета доматено пюре, бобови',
		monthlyVolume: '290 тона',
		notes:
			'Изисква бърза валидация на сертификатите и стриктен график на експедициите.',
	},
	'c-103': {
		role: 'Ръководител внос',
		region: 'Германия / Нидерландия',
		focus: 'Премиум пшеница, ечемик',
		monthlyVolume: '680 тона',
		notes:
			'Чувствителен към маржа. Предпочита разделени договори със седмичен ценови преглед.',
	},
};


function PricingCard({
	title,
	price,
	period,
	note = '',
	popular = false,
	badgeText = '',
	lang,
	labels,
}: {
	title: string;
	price: string;
	period: string;
	note?: string;
	popular?: boolean;
	badgeText?: string;
	lang: Lang;
	labels: {
		bestValue: string;
		subscribe: string;
		per: string;
	};
}) {
	const handleSubscribe = () => {
		const subject = encodeURIComponent(
			lang === 'bg'
				? `Запитване за абонамент: план ${title}`
				: `Subscription Inquiry: ${title} Plan`
		);
		const body = encodeURIComponent(
			lang === 'bg'
				? `Здравейте, искам да се абонирам за плана ${title} (€${price}/${period}) в AgriNexus. Моля за съдействие за onboarding на info@agrinexus.eu.\n`
				: `Hello, I would like to subscribe to the ${title} plan (€${price}/${period}) for AgriNexus. Please reach me at info@agrinexus.eu for onboarding.\n`
		);
		window.location.href = `mailto:info@agrinexus.eu?subject=${subject}&body=${body}`;
	};

	return (
		<div className={`pricing-card ${popular ? 'popular' : ''}`}>
			{(popular || badgeText) && <div className="badge">{badgeText || labels.bestValue}</div>}
			<h3>{title}</h3>
			<div className="pricing-value">€{price}</div>
			<p className="muted">
				{labels.per} {period}
			</p>
			{note && <p className="green-note">{note}</p>}
			<button
				className={`btn ${popular ? 'btn-primary' : 'btn-light'}`}
				onClick={handleSubscribe}>
				<CreditCard size={18} /> {labels.subscribe}
			</button>
		</div>
	);
}

async function apiChat(
	messages: ChatTurn[],
	dealContext: string,
	locale: Lang,
	signal?: AbortSignal
): Promise<string> {
	const timeoutMs = 15000;
	const maxAttempts = 2;
	const requestBody = JSON.stringify({ messages, dealContext, locale });

	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		const timeoutController = new AbortController();
		const requestController = new AbortController();
		let timeoutFired = false;
		let timeoutId: ReturnType<typeof setTimeout> | null = null;

		const abortRequest = () => requestController.abort();
		signal?.addEventListener('abort', abortRequest);
		timeoutId = setTimeout(() => {
			timeoutFired = true;
			requestController.abort();
		}, timeoutMs);

		try {
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: requestBody,
				signal: requestController.signal,
			});
			const rawText = await res.text();
			let data: { reply?: string; error?: string; hint?: string } = {};
			if (rawText.trim()) {
				try {
					data = JSON.parse(rawText) as typeof data;
				} catch {
					throw new Error(
						locale === 'bg'
							? `Сървърът не върна валиден JSON (код ${res.status}). Проверете дали /api/chat работи на хостинга.`
							: `Server did not return valid JSON (HTTP ${res.status}). Check that /api/chat is deployed.`
					);
				}
			}
			if (!res.ok) {
				throw new Error(
					data.hint ||
						data.error ||
						(locale === 'bg' ? 'Грешка при чат заявка' : 'Chat request failed')
				);
			}
			if (!data.reply) {
				throw new Error(locale === 'bg' ? 'Празен AI отговор' : 'Empty AI response');
			}
			return data.reply;
		} catch (err) {
			if (signal?.aborted) {
				const abortError = new Error('Chat request aborted');
				abortError.name = 'AbortError';
				throw abortError;
			}
			const isNetworkError = err instanceof TypeError;
			const isRetryable = timeoutFired || isNetworkError;
			const shouldRetry = isRetryable && attempt < maxAttempts;
			if (!shouldRetry) {
				if (timeoutFired) {
					throw new Error(
						locale === 'bg'
							? 'Чат заявката изтече по време. Проверете връзката и опитайте отново.'
							: 'Chat request timed out. Check your connection and try again.'
					);
				}
				throw err;
			}
			await new Promise(resolve => setTimeout(resolve, 450));
		} finally {
			if (timeoutId) clearTimeout(timeoutId);
			signal?.removeEventListener('abort', abortRequest);
			timeoutController.abort();
		}
	}

	throw new Error(locale === 'bg' ? 'Грешка при чат заявка' : 'Chat request failed');
}

export default function App() {
	const [view, setView] = useState<View>('landing');
	const [lang, setLang] = useState<Lang>(() =>
		safeLocalGet('agrinexus-lang') === 'en' ? 'en' : 'bg'
	);
	const [isPremium] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [selectedCategory, setSelectedCategory] = useState<DealCategoryFilter>('all');
	const [watchlistPanel, setWatchlistPanel] = useState<WatchlistPanel>('saved');
	const [nextUpdate, setNextUpdate] = useState(30 * 60);
	const [refreshTick, setRefreshTick] = useState(0);
	const [marketQuotes, setMarketQuotes] = useState<MarketQuotesApi | null>(null);
	const [quotesLoading, setQuotesLoading] = useState(false);
	const [marketFlashIndex, setMarketFlashIndex] = useState(0);
	const [selectedClientId, setSelectedClientId] = useState(CLIENT_PROFILES[0].id);
	const [isMobileViewport, setIsMobileViewport] = useState(() =>
		typeof window !== 'undefined' ? window.matchMedia('(max-width: 900px)').matches : false
	);

	const [chatMessages, setChatMessages] = useState<ChatTurn[]>([]);
	const [chatInput, setChatInput] = useState(
		() => safeSessionGet('agrinexus-chat-draft') ?? ''
	);
	const [chatLoading, setChatLoading] = useState(false);
	const chatAbortRef = useRef<AbortController | null>(null);
	const chatEndRef = useRef<HTMLDivElement | null>(null);

	const [regFullName, setRegFullName] = useState('');
	const [regCompany, setRegCompany] = useState('');
	const [regEmail, setRegEmail] = useState('');
	const [regPassword, setRegPassword] = useState('');
	const [regMarket, setRegMarket] = useState('');
	const [regPhone, setRegPhone] = useState('');
	const [regSubscribe, setRegSubscribe] = useState(true);
	const [regStatus, setRegStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle');
	const [regMsg, setRegMsg] = useState('');

	const [contactName, setContactName] = useState('');
	const [contactEmail, setContactEmail] = useState('');
	const [contactCompany, setContactCompany] = useState('');
	const [contactBody, setContactBody] = useState('');
	const [contactStatus, setContactStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle');
	const [contactFeedback, setContactFeedback] = useState('');
	const [watchlistIds, setWatchlistIds] = useState<number[]>(() => {
		try {
			const raw = safeLocalGet('agrinexus-watchlist');
			return raw ? (JSON.parse(raw) as number[]) : [];
		} catch {
			return [];
		}
	});
	const [alertsEnabledIds, setAlertsEnabledIds] = useState<number[]>(() => {
		try {
			const raw = safeLocalGet('agrinexus-alerts');
			return raw ? (JSON.parse(raw) as number[]) : [];
		} catch {
			return [];
		}
	});
	const [alertThreshold, setAlertThreshold] = useState<number>(() => {
		const raw = safeLocalGet('agrinexus-alert-threshold');
		const value = raw ? Number(raw) : 20;
		return Number.isFinite(value) ? value : 20;
	});
	const [alertsMuted, setAlertsMuted] = useState<boolean>(
		() => safeLocalGet('agrinexus-alerts-muted') === '1'
	);
	const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
	const formatPhoneInput = (value: string) => {
		const digitsOnly = value.replace(/\D/g, '');
		if (!digitsOnly) return '';
		return `+${digitsOnly}`.slice(0, 16);
	};
	const isValidPhoneInput = (value: string) => {
		const normalized = formatPhoneInput(value);
		if (!normalized) return true;
		return /^\+[1-9]\d{7,14}$/.test(normalized);
	};
	const canSubmitRegister =
		regFullName.trim().length > 1 &&
		regCompany.trim().length > 1 &&
		isValidEmail(regEmail) &&
		isValidPhoneInput(regPhone) &&
		regMarket.trim().length > 1;
	const showRegisterEmailError = regEmail.trim().length > 0 && !isValidEmail(regEmail);
	const showContactEmailError = contactEmail.trim().length > 0 && !isValidEmail(contactEmail);
	const showRegisterPhoneError = regPhone.trim().length > 0 && !isValidPhoneInput(regPhone);
	const invalidEmailText =
		lang === 'bg'
			? 'Моля, въведи валиден имейл адрес.'
			: 'Please enter a valid email address.';
	const invalidPhoneText =
		lang === 'bg'
			? 'Моля, въведи телефон в E.164 формат (напр. +359881234567).'
			: 'Please enter phone in E.164 format (e.g. +359881234567).';
	const phoneHelperText =
		lang === 'bg'
			? 'Използвай международен код и само цифри (формат E.164).'
			: 'Use country code and digits only (E.164 format).';

	const demoDeals = useMemo(() => {
		const products = [
					{
						name: 'Wheat (Premium)',
						category: 'Grains' as const,
						pack: 'Bulk (Silo)',
						cert: 'SGS, Phytosanitary',
						qualityOptions: ['Protein 12.5%', 'Protein 11.5%', 'Moisture ≤ 13.5%'],
					},
					{
						name: 'Corn',
						category: 'Grains' as const,
						pack: 'Bulk',
						cert: 'SGS, Phytosanitary',
						qualityOptions: ['Moisture ≤ 14%', 'Broken Kernels ≤ 5%', 'Aflatoxin tested'],
					},
					{
						name: 'Barley',
						category: 'Grains' as const,
						pack: 'Bulk',
						cert: 'Phytosanitary, SGS',
						qualityOptions: ['Test Weight 65+ kg/hl', 'Moisture ≤ 13.5%', 'Foreign Matter ≤ 2%'],
					},
					{
						name: 'Sunflower Seed',
						category: 'Oilseeds' as const,
						pack: 'Bulk',
						cert: 'SGS, HACCP',
						qualityOptions: ['Oil Content 44%+', 'Moisture ≤ 9%', 'Impurities ≤ 2%'],
					},
					{
						name: 'Rapeseed',
						category: 'Oilseeds' as const,
						pack: 'Bulk',
						cert: 'SGS',
						qualityOptions: ['Oil Content 40%+', 'Moisture ≤ 8%', 'Erucic Acid compliant'],
					},
					{
						name: 'Chickpeas',
						category: 'Pulses' as const,
						pack: '25kg PP Bags',
						cert: 'HALAL, Export',
						qualityOptions: ['8-9 mm caliber', 'Moisture ≤ 12%', 'Cleaned / sorted'],
					},
					{
						name: 'Lentils',
						category: 'Pulses' as const,
						pack: '25kg PP Bags',
						cert: 'HALAL, Export',
						qualityOptions: ['Size 4-6 mm', 'Foreign Matter ≤ 0.5%', 'Moisture ≤ 13%'],
					},
					{
						name: 'Tomato Paste',
						category: 'Processed Foods' as const,
						pack: '70g Sachet / 24pcs',
						cert: 'HALAL, Saber',
						qualityOptions: ['Brix 28-30%', 'No additives', 'Aseptic line'],
					},
					{
						name: 'Peeled Tomatoes',
						category: 'Processed Foods' as const,
						pack: '400g Tin Can',
						cert: 'HALAL, ISO',
						qualityOptions: ['Whole peeled grade A', 'Drained Weight compliant', 'EU origin'],
					},
					{
						name: 'Sunflower Oil',
						category: 'Processed Foods' as const,
						pack: '1L / 5L PET',
						cert: 'ISO 22000, HACCP',
						qualityOptions: ['Refined, deodorized', 'FFA ≤ 0.1%', 'Peroxide compliant'],
					},
				];
		const incoterms = ['FOB', 'CIF', 'DAP', 'FCA'];
		const deliveryWindows = ['7-14 days', '15-30 days', '30-45 days'];

		const sourceCountries = [
					'Bulgaria',
					'Romania',
					'Greece',
					'Turkey',
					'Serbia',
					'Poland',
					'Ukraine',
					'Spain',
					'Hungary',
					'France',
					'Italy',
					'Netherlands',
				];

		const importMarkets = [
					{
						to: 'Cairo, Egypt',
						cur: 'EGP',
						mult: 56,
						flag: '🇪🇬',
						region: 'MENA',
						demandBoost: 1.2,
					},
					{
						to: 'Alexandria, Egypt',
						cur: 'EGP',
						mult: 56,
						flag: '🇪🇬',
						region: 'MENA',
						demandBoost: 1.15,
					},
					{ to: 'Dubai, UAE', cur: 'AED', mult: 4, flag: '🇦🇪', region: 'MENA', demandBoost: 1.1 },
					{
						to: 'Abu Dhabi, UAE',
						cur: 'AED',
						mult: 4,
						flag: '🇦🇪',
						region: 'MENA',
						demandBoost: 1.05,
					},
					{
						to: 'Riyadh, KSA',
						cur: 'SAR',
						mult: 4.1,
						flag: '🇸🇦',
						region: 'MENA',
						demandBoost: 1.1,
					},
					{
						to: 'Jeddah, KSA',
						cur: 'SAR',
						mult: 4.1,
						flag: '🇸🇦',
						region: 'MENA',
						demandBoost: 1.08,
					},
					{
						to: 'Doha, Qatar',
						cur: 'QAR',
						mult: 4,
						flag: '🇶🇦',
						region: 'MENA',
						demandBoost: 1.07,
					},
					{
						to: 'Kuwait City, Kuwait',
						cur: 'KWD',
						mult: 0.31,
						flag: '🇰🇼',
						region: 'MENA',
						demandBoost: 1.08,
					},
					{
						to: 'Amman, Jordan',
						cur: 'JOD',
						mult: 0.71,
						flag: '🇯🇴',
						region: 'MENA',
						demandBoost: 1.04,
					},
					{
						to: 'Casablanca, Morocco',
						cur: 'MAD',
						mult: 10.7,
						flag: '🇲🇦',
						region: 'MENA',
						demandBoost: 1.02,
					},
					{
						to: 'Berlin, Germany',
						cur: 'EUR',
						mult: 1,
						flag: '🇩🇪',
						region: 'EU',
						demandBoost: 0.96,
					},
					{
						to: 'Milan, Italy',
						cur: 'EUR',
						mult: 1,
						flag: '🇮🇹',
						region: 'EU',
						demandBoost: 0.95,
					},
					{
						to: 'Paris, France',
						cur: 'EUR',
						mult: 1,
						flag: '🇫🇷',
						region: 'EU',
						demandBoost: 0.95,
					},
					{
						to: 'Madrid, Spain',
						cur: 'EUR',
						mult: 1,
						flag: '🇪🇸',
						region: 'EU',
						demandBoost: 0.94,
					},
					{
						to: 'Amsterdam, Netherlands',
						cur: 'EUR',
						mult: 1,
						flag: '🇳🇱',
						region: 'EU',
						demandBoost: 0.93,
					},
					{
						to: 'Warsaw, Poland',
						cur: 'PLN',
						mult: 4.3,
						flag: '🇵🇱',
						region: 'EU',
						demandBoost: 0.96,
					},
					{
						to: 'Athens, Greece',
						cur: 'EUR',
						mult: 1,
						flag: '🇬🇷',
						region: 'EU',
						demandBoost: 0.94,
					},
					{
						to: 'Bucharest, Romania',
						cur: 'RON',
						mult: 5,
						flag: '🇷🇴',
						region: 'EU',
						demandBoost: 0.95,
					},
				];


		const seededRand = (seed: number) => {
			const x = Math.sin(seed) * 10000;
			return x - Math.floor(x);
		};

		return Array.from({ length: 240 }, (_, i) => {
			const product = products[i % products.length];
			const market = importMarkets[i % importMarkets.length];
			const base = market.region === 'MENA' ? 13 : 8;
			const randomFactor = Math.floor(seededRand(i + 1 + refreshTick) * 13);
			const prevRandomFactor = Math.floor(
				seededRand(i + 1 + Math.max(0, refreshTick - 1)) * 13
			);
			const profit = Math.round((base + randomFactor) * market.demandBoost);
			const prevProfit = Math.round((base + prevRandomFactor) * market.demandBoost);
			const margin = Math.max(5, profit - 4);
			const currentPrice = `${(seededRand(i + 99 + refreshTick) * 8 * market.mult + 0.35).toFixed(2)} ${market.cur}`;
			const prevPrice = `${(seededRand(i + 99 + Math.max(0, refreshTick - 1)) * 8 * market.mult + 0.35).toFixed(2)} ${market.cur}`;
			const volatility = getVolatility(profit, prevProfit);

			return {
				id: i + 1,
				product: product.name,
				category: product.category,
				packaging: product.pack,
				certification: product.cert,
				qualitySpec: product.qualityOptions[i % product.qualityOptions.length],
				availableVolume: `${Math.round(120 + seededRand(i + 333 + refreshTick) * 1780)} tons`,
				incoterm: incoterms[i % incoterms.length],
				deliveryWindow: deliveryWindows[i % deliveryWindows.length],
				from: sourceCountries[i % sourceCountries.length],
				to: market.to,
				flag: market.flag,
				profit,
				prevProfit,
				margin,
				price: currentPrice,
				prevPrice,
				isMENA: market.region === 'MENA',
				decision: getDecisionBySignals({
					profit,
					volatility,
					category: product.category,
				}),
				volatility,
			} satisfies DealRow;
		});
	}, [refreshTick]);

	const allDeals = useMemo((): DealRow[] => {
		if (
			marketQuotes &&
			marketQuotes.ok &&
			marketQuotes.mode === 'live' &&
			marketQuotes.quotes.length > 0
		) {
			return mergeLiveIntoDeals(demoDeals, marketQuotes.quotes, lang);
		}
		return demoDeals;
	}, [demoDeals, marketQuotes, lang]);

	const searchableDeals = useMemo<SearchableDeal[]>(
		() =>
			allDeals.map(deal => {
				const productAliases = PRODUCT_BG_ALIASES[deal.product] ?? [];
				const categoryAliases = CATEGORY_BG_ALIASES[deal.category] ?? [];
				const searchText = [
					deal.product,
					deal.category,
					...categoryAliases,
					...productAliases,
					deal.certification,
					deal.qualitySpec,
					deal.packaging,
					deal.from,
					deal.to,
					deal.deliveryWindow,
					deal.incoterm,
					deal.referenceSymbol ?? '',
					deal.priceSource ?? '',
				]
					.join(' ')
					.toLowerCase();
				return { ...deal, searchText };
			}),
		[allDeals]
	);

	const filteredDeals = searchableDeals.filter(d => {
		const q = searchQuery.trim().toLowerCase();
		const matchesCategory = selectedCategory === 'all' || d.category === selectedCategory;
		const matchesQuery = q === '' || d.searchText.includes(q);
		return matchesCategory && matchesQuery;
	});

	const grainUniverse = useMemo(
		() => allDeals.filter(deal => deal.category === 'Grains'),
		[allDeals]
	);

	const grainInsights = useMemo(() => {
		const scoped =
			selectedCategory === 'Grains'
				? filteredDeals.filter(deal => deal.category === 'Grains')
				: grainUniverse;
		if (scoped.length === 0) {
			return {
				count: 0,
				avgMargin: 0,
				buyCount: 0,
				topRoute: '—',
				topProduct: '—',
			};
		}
		const avgMargin = Math.round(
			scoped.reduce((sum, deal) => sum + deal.margin, 0) / scoped.length
		);
		const buyCount = scoped.filter(deal => deal.decision === 'BUY').length;
		const topDeal = [...scoped].sort((a, b) => b.profit - a.profit)[0];
		return {
			count: scoped.length,
			avgMargin,
			buyCount,
			topRoute: `${topDeal.from} → ${topDeal.to}`,
			topProduct: topDeal.product,
		};
	}, [filteredDeals, grainUniverse, selectedCategory]);

	const dealContextForAI = useMemo(() => {
		const slice = filteredDeals.slice(0, 18);
		const feedNote =
			marketQuotes?.ok && marketQuotes.mode === 'live'
				? lang === 'bg'
					? '[Пазар: забавени фючърсни референции от Stooq за мапнати стоки; редове без инструмент са илюстративни; не са оферти.]\n'
					: '[Market: delayed futures refs from Stooq for mapped products; rows without a listed instrument remain illustrative; not offers.]\n'
				: '';
		return (
			feedNote +
			slice
				.map(
					d =>
						`#${d.id} ${d.product} | ${d.from}→${d.to} | ${d.decision} | est. +${d.profit}% | ${d.price}${d.priceSource === 'futures_delayed' ? ` | ref:${d.referenceSymbol ?? ''}` : ''}`
				)
				.join('\n')
		);
	}, [filteredDeals, marketQuotes, lang]);

	const topMovers = useMemo(
		() =>
			[...filteredDeals]
				.sort(
					(a, b) => Math.abs(b.profit - b.prevProfit) - Math.abs(a.profit - a.prevProfit)
				)
				.slice(0, 4),
		[filteredDeals]
	);

	useEffect(() => {
		const timer = setInterval(() => {
			setNextUpdate(prev => {
				if (prev <= 1) {
					setRefreshTick(v => v + 1);
					return 30 * 60;
				}
				return prev - 1;
			});
		}, 1000);
		return () => clearInterval(timer);
	}, []);

	useEffect(() => {
		const flashTimer = setInterval(() => {
			const flashes = lang === 'bg' ? MARKET_FLASH_BG : MARKET_FLASH_EN;
			setMarketFlashIndex(v => (v + 1) % flashes.length);
		}, 9000);
		return () => clearInterval(flashTimer);
	}, [lang]);

	useEffect(() => {
		safeLocalSet('agrinexus-watchlist', JSON.stringify(watchlistIds));
	}, [watchlistIds]);

	useEffect(() => {
		safeLocalSet('agrinexus-alerts', JSON.stringify(alertsEnabledIds));
	}, [alertsEnabledIds]);

	useEffect(() => {
		safeLocalSet('agrinexus-lang', lang);
	}, [lang]);

	useEffect(() => {
		safeLocalSet('agrinexus-alert-threshold', String(alertThreshold));
	}, [alertThreshold]);

	useEffect(() => {
		safeLocalSet('agrinexus-alerts-muted', alertsMuted ? '1' : '0');
	}, [alertsMuted]);

	useEffect(() => {
		if (import.meta.env.VITE_SKIP_MARKET_QUOTES === '1') {
			setMarketQuotes({
				ok: true,
				mode: 'demo',
				quotes: [],
				fetchedAt: new Date().toISOString(),
				source: null,
			});
			setQuotesLoading(false);
			return;
		}

		let cancelled = false;
		setQuotesLoading(true);
		void fetch('/api/market-quotes')
			.then(r => r.json() as Promise<MarketQuotesApi>)
			.then(data => {
				if (!cancelled) setMarketQuotes(data);
			})
			.catch(() => {
				if (!cancelled) {
					setMarketQuotes({
						ok: false,
						mode: 'error',
						quotes: [],
						fetchedAt: new Date().toISOString(),
						source: null,
						error: 'network',
					});
				}
			})
			.finally(() => {
				if (!cancelled) setQuotesLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [refreshTick]);

	const formatTime = `${Math.floor(nextUpdate / 60)}:${(nextUpdate % 60).toString().padStart(2, '0')}`;
	const selectedClient =
		CLIENT_PROFILES.find(profile => profile.id === selectedClientId) || CLIENT_PROFILES[0];
	const selectedClientLocalized =
		lang === 'bg'
			? {
					...selectedClient,
					...CLIENT_PROFILE_BG_COPY[selectedClient.id],
				}
			: selectedClient;
	const selectedClientStatusLabel =
		lang === 'bg'
			? selectedClient.creditStatus === 'Approved'
				? 'Одобрен'
				: selectedClient.creditStatus === 'Pending'
					? 'В изчакване'
					: 'Преглед'
			: selectedClient.creditStatus;
	const tickerItems = filteredDeals.slice(0, 12);
	const watchedDeals = allDeals.filter(deal => watchlistIds.includes(deal.id));
	const lastSavedDeal = useMemo(() => {
		const lastSavedId = watchlistIds[watchlistIds.length - 1];
		if (!lastSavedId) return null;
		return allDeals.find(deal => deal.id === lastSavedId) ?? null;
	}, [allDeals, watchlistIds]);
	const lastAlertDeal = useMemo(() => {
		const lastAlertId = alertsEnabledIds[alertsEnabledIds.length - 1];
		if (!lastAlertId) return null;
		return allDeals.find(deal => deal.id === lastAlertId) ?? null;
	}, [alertsEnabledIds, allDeals]);

	const toggleWatchlist = (dealId: number) => {
		setWatchlistIds(prev =>
			prev.includes(dealId) ? prev.filter(id => id !== dealId) : [...prev, dealId]
		);
	};

	const toggleAlert = (dealId: number) => {
		setAlertsEnabledIds(prev =>
			prev.includes(dealId) ? prev.filter(id => id !== dealId) : [...prev, dealId]
		);
	};

	const forceRefreshDeals = () => {
		setRefreshTick(v => v + 1);
		setNextUpdate(30 * 60);
	};

	const sendChat = useCallback(async () => {
		const trimmed = chatInput.trim();
		if (!trimmed || chatLoading) return;
		chatAbortRef.current?.abort();
		const controller = new AbortController();
		chatAbortRef.current = controller;

		const nextUser: ChatTurn = { role: 'user', content: trimmed };
		const history = [...chatMessages, nextUser];
		setChatMessages(history);
		setChatInput('');
		safeSessionRemove('agrinexus-chat-draft');
		setChatLoading(true);
		try {
			const payload = history
				.filter(m => m.role === 'user' || m.role === 'assistant')
				.slice(-16);
			const reply = await apiChat(payload, dealContextForAI, lang, controller.signal);
			setChatMessages(prev => [...prev, { role: 'assistant', content: reply }]);
		} catch (e) {
			const name =
				typeof e === 'object' && e && 'name' in e
					? String((e as { name: string }).name)
					: '';
			if (name === 'AbortError') return;
			const msg =
				e instanceof Error
					? e.message
					: lang === 'bg'
						? 'Грешка при AI заявка'
						: 'AI request error';
			const normalized = msg.includes('OpenAI is not configured')
				? lang === 'bg'
					? 'AI не е конфигуриран на сървъра. Добавете OPENAI_API_KEY в променливите на средата (напр. Vercel).'
					: 'AI is not configured on the server. Add OPENAI_API_KEY to environment variables (e.g. Vercel).'
				: msg;
			setChatMessages(prev => [...prev, { role: 'assistant', content: normalized }]);
		} finally {
			if (chatAbortRef.current === controller) chatAbortRef.current = null;
			setChatLoading(false);
		}
	}, [chatInput, chatLoading, chatMessages, dealContextForAI, lang]);

	useEffect(() => {
		safeSessionSet('agrinexus-chat-draft', chatInput);
	}, [chatInput]);

	useEffect(() => {
		if (view !== 'assistant') return;
		chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
	}, [chatMessages, chatLoading, view]);

	useEffect(() => () => chatAbortRef.current?.abort(), []);

	const applyQuickPrompt = (prompt: string) => {
		setChatInput(prompt);
	};

	useEffect(() => {
		const media = window.matchMedia('(max-width: 900px)');
		const updateMobile = () => setIsMobileViewport(media.matches);
		updateMobile();
		media.addEventListener('change', updateMobile);
		return () => media.removeEventListener('change', updateMobile);
	}, []);

	const submitRegister = async () => {
		if (!canSubmitRegister || regStatus === 'loading') return;
		if (!isValidEmail(regEmail)) {
			setRegStatus('err');
			setRegMsg(
				lang === 'bg'
					? 'Моля, въведи валиден имейл адрес.'
					: 'Please enter a valid email address.'
			);
			return;
		}
		if (!isValidPhoneInput(regPhone)) {
			setRegStatus('err');
			setRegMsg(invalidPhoneText);
			return;
		}
		setRegStatus('loading');
		setRegMsg('');
		try {
			const res = await fetch('/api/register-interest', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					fullName: regFullName,
					companyName: regCompany,
					businessEmail: regEmail,
					phone: formatPhoneInput(regPhone),
					marketFocus: regMarket,
					subscribeAlerts: regSubscribe,
				}),
			});
			let data: {
				ok?: boolean;
				error?: string;
				hint?: string;
				preview?: string;
			} = {};
			try {
				data = (await res.json()) as typeof data;
			} catch {
				data = {};
			}
			if (!res.ok) {
				setRegStatus('err');
				setRegMsg(
					data.hint ||
						data.error ||
						(lang === 'bg' ? 'Неуспешно изпращане' : 'Failed to submit')
				);
				return;
			}
			setRegStatus('ok');
			setRegMsg(
				lang === 'bg'
					? 'Изпратено до info@agrinexus.eu — очаквайте потвърждение на имейла ви.'
					: 'Sent to info@agrinexus.eu — please expect a confirmation by email.'
			);
			setRegPassword('');
		} catch {
			setRegStatus('err');
			setRegMsg(lang === 'bg' ? 'Мрежова грешка.' : 'Network error.');
		}
	};

	const submitContact = async () => {
		if (contactStatus === 'loading' || !contactEmail.trim() || !contactBody.trim()) return;
		if (!isValidEmail(contactEmail)) {
			setContactStatus('err');
			setContactFeedback(
				lang === 'bg'
					? 'Моля, въведи валиден имейл адрес.'
					: 'Please enter a valid email address.'
			);
			return;
		}
		setContactStatus('loading');
		setContactFeedback('');
		try {
			const res = await fetch('/api/contact', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: contactName,
					email: contactEmail,
					company: contactCompany,
					message: contactBody,
				}),
			});
			let data: { ok?: boolean; error?: string; hint?: string } = {};
			try {
				data = (await res.json()) as typeof data;
			} catch {
				data = {};
			}
			if (!res.ok) {
				setContactStatus('err');
				setContactFeedback(
					data.hint ||
						data.error ||
						(lang === 'bg' ? 'Неуспешно изпращане' : 'Failed to submit')
				);
				return;
			}
			setContactStatus('ok');
			setContactFeedback(
				lang === 'bg'
					? 'Съобщението е изпратено. Отговорът идва от info@agrinexus.eu.'
					: 'Message sent. A reply will come from info@agrinexus.eu.'
			);
			setContactBody('');
		} catch {
			setContactStatus('err');
			setContactFeedback(lang === 'bg' ? 'Мрежова грешка.' : 'Network error.');
		}
	};

	const handleDemoSignIn = () => {
		setView('company');
	};

	const tr = useMemo(() => {
		if (lang === 'bg') {
			return {
				navHome: 'Начало',
				navMarket: 'Пазар',
				navAssistant: 'AI помощник',
				navAutomation: 'Автоматизация',
				navPricing: 'Абонаменти',
				navClients: 'Клиенти',
				navWatchlist: 'Списък',
				navLogin: 'Вход',
				navGetStarted: 'Започни',
				skipToContent: 'Към съдържанието',
				navPrimaryAria: 'Основна навигация',
				mobileNavAria: 'Мобилно меню',
				brandHomeAria: 'AgriNexus — начало',
				langAria: 'Превключи език',
				heroSub:
					'AI слой за агротърговия в Европа и MENA — BUY/HOLD/AVOID и работен поток на едно място. Целта е интеграция с борси и консолидирани котировки по коридори; прегледът в сайта днес е илюстративен демо каталог, не живи борсови цени.',
				createAccount: 'Създай акаунт',
				livePreview: 'Преглед на пазара (демо)',
				activeOpps: 'Активни възможности',
				liveDealsHint:
					'Илюстративни примери за ориентация — не са реални сключени сделки или оферти.',
				demoBadge: 'Демо',
				demoMarketBanner:
					'Пазарът показва синтетични примери за демонстрация на продукта. Цените, маршрутите и маржовете не са реални котировки или договори.',
				marketQuotesLoading: 'Зареждане на пазарни котировки…',
				liveMarketBannerStooq:
					'Живи забавени фючърсни референции (Stooq) за мапнатите стоки — не са оферти за физически товар. Продукти без ликвиден глобален фючърс (напр. домати) показват илюстративни числа за подредба на екрана.',
				liveMarketErrorBanner:
					'Живият поток от котировки е временно недостъпен — показват се синтетични примери. Опитайте „Обнови“ или проверете сървъра.',
				unlockSub:
					'С абонамент премахваме ограничението за преглед на всички редове и детайли в този демо каталог.',
				openMarketplace: 'Целият пазар',
				clientDossiers: 'Клиентски досиета',
				menaBadge: 'ПАЗАР MENA',
				euBadge: 'ПАЗАР EU',
				premiumAccess: 'Premium достъп',
				contactSales: 'Продажби — info@agrinexus.eu',
				contactHelp:
					'Изпратете запитване към екипа. При активиран SMTP записваме съобщението и изпращаме копие до вас.',
				phName: 'Име',
				phEmail: 'Имейл',
				phCompany: 'Компания',
				phMessage: 'Съобщение',
				send: 'Изпрати',
				searchPh: 'Търсене по продукт, страна или дестинация…',
				aiUpdateIn: 'Следваща AI актуализация след',
				decision: 'Решение',
				estMargin: 'Очакван марж',
				unlock: 'Пълен достъп',
				coverageTitle: 'Капацитет и покритие',
				coverageBody:
					'Мулти-държавно търсене и предлагане в EU + MENA в демо каталога. Оценките BUY/HOLD/AVOID следват вашите филтри и показаните редове — при реални борсови потоци ще се подменят с актуални данни.',
				watchlistTitle: 'Моят списък',
				watchlistEmpty: 'Няма запазени сделки. Отвори Пазара и натисни „Запази“.',
				watchlistStorageHint:
					'Не се изисква вход за преглед: запазеното се записва локално в този браузър (до изчистване на данните).',
				watchlistTabSaved: 'Запазени сделки',
				watchlistTabCabinet: 'Моят кабинет',
				cabinetTitle: 'Търговски кабинет',
				cabinetSubtitle:
					'Бърз достъп до важните модули за работа с клиенти, пазар и абонаменти.',
				cabinetSavedCount: 'Запазени сделки',
				cabinetAlertsCount: 'Активни известия',
				cabinetLastSaved: 'Последно запазена сделка',
				cabinetLastAlert: 'Последно включено известие',
				cabinetNoActivity: 'Няма активност',
				cabinetGoMarket: 'Към Пазар',
				cabinetGoClients: 'Към Клиенти',
				cabinetGoCompany: 'Към Фирмен профил',
				cabinetGoPricing: 'Към Абонаменти',
				watchSaved: '★ Запазено',
				watchSave: 'Запази',
				alertOn: 'Известия вкл.',
				alertOff: 'Известия',
				alertMute: 'Без звук за известия',
				alertThreshold: 'Праг %',
				terminalVol: 'Волатилност',
				marketPulse: 'Пазарен импулс (демо)',
				assistantTitle: 'AI помощник',
				assistantSubtitle:
					'Контекстът идва от текущите ви филтри в Пазара (до 18 от показаните сделки). Отговорите са ориентировъчни — не са правни или финансови съвети.',
				assistantBack: 'Към Пазара',
				assistantLegalFooter:
					'AgriNexus не поема отговорност за действия въз основа на AI отговори. За реални сделки потърсете потвърждение от вашия екип.',
				automationTitle: 'Автоматизация на бизнеса',
				automationSubtitle:
					'Свързваме пазара, клиентските досиета, AI оценките и търговските известия в един работен поток за по-малко ръчна работа и по-бърза реакция.',
				automationLeadTitle: 'Какво се автоматизира',
				automationLeadBody:
					'AgriNexus може да поеме повтаряемите стъпки около запитвания, проверка на марж, приоритизация на клиенти и подготовка на следващо действие.',
				automationStep1: 'Входящо запитване',
				automationStep1Body: 'Клиент, продукт, пазар и обем се записват като структурирана заявка.',
				automationStep2: 'AI оценка',
				automationStep2Body: 'Системата сравнява маршрут, марж, волатилност, сертификати и риск.',
				automationStep3: 'Търговско действие',
				automationStep3Body: 'Екипът получава приоритет, известие и готов контекст за оферта или follow-up.',
				automationOpsTitle: 'Оперативни процеси',
				automationOps1: 'Автоматични известия при сделки над зададен праг на марж.',
				automationOps2: 'Клиентски кабинет със запазени сделки, активност и последно действие.',
				automationOps3: 'AI помощник, който работи върху текущите филтри и избраните пазари.',
				automationOps4: 'Подготовка за интеграции с CRM, имейл и реални борсови/vendor потоци.',
				automationCta: 'Виж търговския кабинет',
				chatThinking: 'Мисля…',
				chatPromptsLabel: 'Бързи подкани',
				chatClear: 'Изчисти',
				chatPlaceholder: 'Попитайте за маршрут, марж, сертификати…',
				mobileAssistantTab: 'AI',
				dealCategory: 'Категория',
				dealQuality: 'Качество',
				dealVolume: 'Обем',
				dealIncoterm: 'Incoterm',
				dealDelivery: 'Доставка',
				filterAll: 'Всички',
				filterGrains: 'Зърнени',
				filterOilseeds: 'Маслодайни',
				filterPulses: 'Бобови',
				filterProcessed: 'Преработени',
				grainInsightTitle: 'Зърнени: бърз обзор',
				grainInsightDeals: 'Сделки',
				grainInsightAvgMargin: 'Среден марж',
				grainInsightBuy: 'BUY сигнали',
				grainInsightTopRoute: 'Топ маршрут',
				grainInsightTopProduct: 'Топ продукт',
				pricingTitle: 'Абонаментни планове',
				pricingBetaBadge: 'Beta pricing',
				pricingBetaNote:
					'Текущите цени са early-access до пълната интеграция с борсови и vendor потоци, планирана в следващите 2–3 месеца.',
				pricingWeekly: 'Седмичен',
				pricingMonthly: 'Месечен',
				pricingYearly: 'Годишен',
				pricingWeek: 'седмица',
				pricingMonth: 'месец',
				pricingYear: 'година',
				pricingBestValue: 'НАЙ-ИЗГОДЕН',
				pricingRecommendedStart: 'ПРЕПОРЪЧАНО ЗА СТАРТ',
				pricingSubscribe: 'Абонирай се',
				pricingPer: 'на',
				pricingYearlyNote: '+1 месец безплатно',
				pricingConceptTitle: 'AI двигател за по-силни търговски решения',
				pricingConceptBody:
					'Абонаментът превръща AgriNexus в практичен AI търговски инструмент: работи върху контекста от прегледа на пазара (демо днес; при връзка с борси — върху живи потоци), подрежда приоритетите и подпомага екипа в бързи, уверени решения.',
				pricingPlanExplainTitle: 'Как работят абонаментните планове',
				pricingPlanExplainBody:
					'Плановете са според интензитета на работа: Седмичен за бърз старт, Месечен за регулярна търговия и Годишен за екипи, които искат най-добра цена и предвидимост.',
				pricingResultTitle: 'Какво печелите в практиката',
				pricingResultBody:
					'По-малко време за анализ, по-ясни приоритети и по-уверени сделки с подкрепа от AI във всеки етап — от филтър до финално решение.',
				pricingContactLead: 'Продажби:',
				pricingContactText: 'всички абонаментни запитвания и оферти се координират от този адрес.',
				pricingFaqTitle: 'Често задавани въпроси',
				pricingFaqQ1: 'Има ли минимален срок на договора?',
				pricingFaqA1: 'Не. Можете да променяте или ъпгрейдвате плана според нуждите си.',
				pricingFaqQ2: 'Как се отчитат AI заявките?',
				pricingFaqA2: 'Лимитът е месечен и се обновява автоматично в началото на периода.',
				pricingFaqQ3: 'Имате ли onboarding за фирми?',
				pricingFaqA3: 'Да. За Pro и Business има onboarding, съобразен с вашия търговски процес.',
				pricingBrandMotto:
					'AgriNexus: AI търговски компас за по-умни решения, по-бързи сделки и по-силен контрол върху маржа.',
				registerTitle: 'Създай акаунт',
				registerSubtitle:
					'Регистрацията изпраща детайли към info@agrinexus.eu и потвърждение към вашия имейл (при SMTP).',
				fullNamePh: 'Име и фамилия',
				companyNamePh: 'Име на компания',
				businessEmailPh: 'Служебен имейл',
				passwordPh: 'Парола',
				marketFocusPh: 'Пазарен фокус',
				marketEurope: 'Европа',
				marketMena: 'MENA',
				marketBoth: 'И двете',
				phonePh: 'Телефон (по избор, напр. +359881234567)',
				agreeUpdates: 'Съгласен съм да получавам пазарни ъпдейти и търговски известия по имейл.',
				createMyAccount: 'Създай акаунт',
				alreadyHaveAccount: 'Вече имам акаунт',
				loginTitle: 'Вход',
				loginSubtitle:
					'Production authentication ще се върже към вашия identity provider. За демо ползвайте регистрацията по имейл.',
				loginEmailPh: 'Имейл',
				loginPasswordPh: 'Парола',
				loginBtn: 'Вход',
				companyTitle: 'AgriNexus - Фирмена карта',
				companySubtitle:
					'Специализиран AI слой за оптимизация на агротърговията (EU / MENA). По пътя са интеграции към борси и доставчици на котировки, buyer–seller matching, прогнозни цени и търговски известия.',
				companyRegions: 'Региони: Европа / MENA',
				clientsTitle: 'Клиентско портфолио',
				clientsSubtitle:
					'Професионална страница за всеки клиент с контекст за решения, сертификати и търговски предпочитания.',
				clientContact: 'Контакт',
				clientMarketFocus: 'Пазарен фокус',
				clientCertifications: 'Сертификати',
				clientIncoterms: 'Предпочитани Incoterms',
				clientMonthlyVolume: 'Месечен обем',
				clientInternalNotes: 'Вътрешни бележки',
				clientCardLabel: 'Дигитална визитка',
			};
		}
		return {
			navHome: 'Home',
			navMarket: 'Marketplace',
			navAssistant: 'AI assistant',
			navAutomation: 'Automation',
			navPricing: 'Pricing',
			navClients: 'Clients',
			navWatchlist: 'Watchlist',
			navLogin: 'Sign In',
			navGetStarted: 'Get Started',
			skipToContent: 'Skip to content',
			navPrimaryAria: 'Primary navigation',
			mobileNavAria: 'Mobile menu',
			brandHomeAria: 'AgriNexus — home',
			langAria: 'Switch language',
			heroSub:
				'Domain-specific AI layer for agricultural trading in Europe and MENA — BUY/HOLD/AVOID and deal workflow in one place. The roadmap targets exchange feeds and consolidated corridor pricing; what you see today is an illustrative demo catalog, not live exchange quotes.',
			createAccount: 'Create your account',
			livePreview: 'Market preview (demo)',
			activeOpps: 'Active Trade Opportunities',
			liveDealsHint:
				'Illustrative examples for orientation — not real executed trades or binding offers.',
			demoBadge: 'Demo',
			demoMarketBanner:
				'The marketplace shows synthetic examples for product demonstration. Prices, routes and margins are not live quotes or contracts.',
			marketQuotesLoading: 'Loading market quotes…',
			liveMarketBannerStooq:
				'Live delayed futures references (Stooq) for mapped commodities — not offers for physical cargo. Products without a liquid listed future (e.g. tomato lines) keep illustrative numbers for layout.',
			liveMarketErrorBanner:
				'Live quote feed unavailable — showing synthetic examples. Try refresh or check the API.',
			unlockSub:
				'With a subscription you can browse every row and detail without this demo limitation.',
			openMarketplace: 'Open full marketplace',
			clientDossiers: 'Client dossiers',
			menaBadge: 'MENA MARKET',
			euBadge: 'EU MARKET',
			premiumAccess: 'Premium Access',
			contactSales: 'Contact sales — info@agrinexus.eu',
			contactHelp:
				'Send a message directly to the team. When SMTP is enabled we store it and email you a copy.',
			phName: 'Name',
			phEmail: 'Email',
			phCompany: 'Company',
			phMessage: 'Message',
			send: 'Send',
			searchPh: 'Search by product, supplier country or destination…',
			aiUpdateIn: 'AI update in:',
			decision: 'Decision',
			estMargin: 'Estimated margin',
			unlock: 'Full access',
			coverageTitle: 'Coverage capacity',
			coverageBody:
				'Multi-country supply and demand across EU + MENA in the demo catalog. BUY/HOLD/AVOID follows your filters and the rows shown — when exchange feeds are connected, those estimates will reflect live data.',
			watchlistTitle: 'Watchlist',
			watchlistEmpty: 'No saved deals yet. Open Marketplace and tap Watch.',
			watchlistStorageHint:
				'No sign-in needed for this screen — saves stay in this browser until cleared.',
			watchlistTabSaved: 'Saved deals',
			watchlistTabCabinet: 'My cabinet',
			cabinetTitle: 'Trading cabinet',
			cabinetSubtitle:
				'Quick access to core modules for clients, marketplace operations and subscriptions.',
			cabinetSavedCount: 'Saved deals',
			cabinetAlertsCount: 'Active alerts',
			cabinetLastSaved: 'Last saved deal',
			cabinetLastAlert: 'Last enabled alert',
			cabinetNoActivity: 'No activity yet',
			cabinetGoMarket: 'Go to Marketplace',
			cabinetGoClients: 'Go to Clients',
			cabinetGoCompany: 'Go to Company profile',
			cabinetGoPricing: 'Go to Pricing',
			watchSaved: '★ Saved',
			watchSave: 'Watch',
			alertOn: 'Alerts on',
			alertOff: 'Alerts',
			alertMute: 'Mute alerts',
			alertThreshold: 'Threshold %',
			terminalVol: 'Volatility',
			marketPulse: 'Market pulse (demo)',
			assistantTitle: 'AI assistant',
			assistantSubtitle:
				'Context comes from your current Marketplace filters (up to 18 visible deals). Answers are indicative — not legal or financial advice.',
			assistantBack: 'Back to marketplace',
			assistantLegalFooter:
				'AgriNexus is not liable for actions taken based on AI replies. Confirm real trades with your team.',
			automationTitle: 'Business automation',
			automationSubtitle:
				'Connect marketplace signals, client dossiers, AI scoring and trade alerts into one operating workflow with less manual coordination and faster response.',
			automationLeadTitle: 'What gets automated',
			automationLeadBody:
				'AgriNexus can carry the repeatable steps around inquiries, margin checks, client prioritization and the next commercial action.',
			automationStep1: 'Incoming inquiry',
			automationStep1Body: 'Client, product, market and volume are captured as structured deal context.',
			automationStep2: 'AI scoring',
			automationStep2Body: 'The system compares route, margin, volatility, certifications and risk.',
			automationStep3: 'Trade action',
			automationStep3Body: 'The team gets priority, alerting and prepared context for an offer or follow-up.',
			automationOpsTitle: 'Operating workflows',
			automationOps1: 'Automatic alerts when deals pass a margin threshold.',
			automationOps2: 'Trading cabinet with saved deals, activity and last action.',
			automationOps3: 'AI assistant grounded in the current filters and selected markets.',
			automationOps4: 'Ready path toward CRM, email, exchange and vendor-feed integrations.',
			automationCta: 'Open trading cabinet',
			chatThinking: 'Thinking…',
			chatPromptsLabel: 'Quick prompts',
			chatClear: 'Clear',
			chatPlaceholder: 'Ask about routes, margin, certifications…',
			mobileAssistantTab: 'AI',
			dealCategory: 'Category',
			dealQuality: 'Quality',
			dealVolume: 'Volume',
			dealIncoterm: 'Incoterm',
			dealDelivery: 'Delivery',
			filterAll: 'All',
			filterGrains: 'Grains',
			filterOilseeds: 'Oilseeds',
			filterPulses: 'Pulses',
			filterProcessed: 'Processed',
			grainInsightTitle: 'Grains quick insight',
			grainInsightDeals: 'Deals',
			grainInsightAvgMargin: 'Avg margin',
			grainInsightBuy: 'BUY signals',
			grainInsightTopRoute: 'Top route',
			grainInsightTopProduct: 'Top product',
			pricingTitle: 'Subscription Plans',
			pricingBetaBadge: 'Beta pricing',
			pricingBetaNote:
				'Current prices are early-access until full exchange and vendor feed integrations are completed, planned within the next 2–3 months.',
			pricingWeekly: 'Weekly',
			pricingMonthly: 'Monthly',
			pricingYearly: 'Yearly',
			pricingWeek: 'week',
			pricingMonth: 'month',
			pricingYear: 'year',
			pricingBestValue: 'BEST VALUE',
			pricingRecommendedStart: 'RECOMMENDED FOR START',
			pricingSubscribe: 'Subscribe',
			pricingPer: 'per',
			pricingYearlyNote: '+1 month free',
			pricingConceptTitle: 'AI engine for stronger trade decisions',
			pricingConceptBody:
				'The subscription turns AgriNexus into a practical AI trade layer: it works off the marketplace context you are viewing (demo today; live streams once feeds are connected), prioritizes opportunities, and helps teams act faster with confidence.',
			pricingPlanExplainTitle: 'How the subscription plans work',
			pricingPlanExplainBody:
				'Plans match your operating intensity: Weekly for fast onboarding, Monthly for steady trading rhythm, and Yearly for teams that need the best value and planning stability.',
			pricingResultTitle: 'What you gain in practice',
			pricingResultBody:
				'Less time spent on manual analysis, clearer priorities, and more confident deals with AI support from market filtering to final trade decision.',
			pricingContactLead: 'Contact sales:',
			pricingContactText:
				'all subscription inquiries and offers are coordinated through this address.',
			pricingFaqTitle: 'Frequently Asked Questions',
			pricingFaqQ1: 'Is there a minimum contract period?',
			pricingFaqA1: 'No. You can change or upgrade your plan based on business needs.',
			pricingFaqQ2: 'How are AI requests counted?',
			pricingFaqA2: 'The quota is monthly and refreshes automatically at the start of each period.',
			pricingFaqQ3: 'Do you provide company onboarding?',
			pricingFaqA3: 'Yes. Pro and Business include onboarding aligned to your trade workflow.',
			pricingBrandMotto:
				'AgriNexus: an AI trade compass for smarter decisions, faster deal execution, and tighter margin control.',
			registerTitle: 'Create Account',
			registerSubtitle:
				'Registration sends details to info@agrinexus.eu and a confirmation to your email (when SMTP is enabled).',
			fullNamePh: 'Full Name',
			companyNamePh: 'Company Name',
			businessEmailPh: 'Business Email',
			passwordPh: 'Password',
			marketFocusPh: 'Market Focus',
			marketEurope: 'Europe',
			marketMena: 'MENA',
			marketBoth: 'Both',
			phonePh: 'Phone (optional, e.g. +359881234567)',
			agreeUpdates: 'I agree to receive market updates and trade alerts by email.',
			createMyAccount: 'Create my account',
			alreadyHaveAccount: 'Already have account',
			loginTitle: 'Sign In',
			loginSubtitle:
				'Production authentication will connect to your identity provider. For demo, use email registration.',
			loginEmailPh: 'Email',
			loginPasswordPh: 'Password',
			loginBtn: 'Sign In',
			companyTitle: 'AgriNexus - Company Card',
			companySubtitle:
				'Domain-specific AI layer for agricultural trade optimization (Europe / MENA). Roadmap: exchange and vendor price feeds, buyer–seller matching, predictive pricing, and trade alerts.',
			companyRegions: 'Regions: Europe / MENA',
			clientsTitle: 'Client Portfolio',
			clientsSubtitle:
				'Professional profile page for each client with decision context, certifications and trading preferences.',
			clientContact: 'Contact',
			clientMarketFocus: 'Market focus',
			clientCertifications: 'Certifications',
			clientIncoterms: 'Preferred incoterms',
			clientMonthlyVolume: 'Monthly volume',
			clientInternalNotes: 'Internal notes',
			clientCardLabel: 'Digital business card',
		};
	}, [lang]);

	const marketBannerMessage = useMemo(() => {
		if (quotesLoading && marketQuotes === null) return tr.marketQuotesLoading;
		if (!marketQuotes || (marketQuotes.ok && marketQuotes.mode === 'demo'))
			return tr.demoMarketBanner;
		if (marketQuotes.ok && marketQuotes.mode === 'live') {
			const ts = marketQuotes.fetchedAt
				? new Date(marketQuotes.fetchedAt).toLocaleString(lang === 'bg' ? 'bg-BG' : 'en-GB', {
						dateStyle: 'short',
						timeStyle: 'medium',
					})
				: '';
			return ts ? `${tr.liveMarketBannerStooq} (${ts})` : tr.liveMarketBannerStooq;
		}
		return `${tr.liveMarketErrorBanner}${marketQuotes.error ? ` (${marketQuotes.error})` : ''}`;
	}, [quotesLoading, marketQuotes, tr, lang]);

	const landingAiCards = useMemo(() => {
		const bgCopy = [
			{
				title: 'КУПИ / ЗАДРЪЖ / ИЗБЕГНИ',
				text: 'AI логика подрежда сделки според филтрите и демо сценариите — готова за реални котировки и борсови потоци, когато са свързани.',
			},
			{
				title: 'Прогнозни цени',
				text: 'Оценка на бъдеща цена и марж преди затваряне на сделка.',
			},
			{
				title: 'Умни известия',
				text: 'Известия по имейл или Telegram при висок марж.',
			},
		];
		const texts =
			lang === 'bg' ? bgCopy : AI_FEATURES.map(f => ({ title: f.title, text: f.text }));
		return AI_FEATURES.map((f, i) => ({ ...f, ...texts[i] }));
	}, [lang]);

	const marketFlashLines = lang === 'bg' ? MARKET_FLASH_BG : MARKET_FLASH_EN;
	const quickPrompts = lang === 'bg' ? QUICK_PROMPTS_BG : QUICK_PROMPTS_EN;
	const categoryCounts = useMemo(() => {
		const counts: Record<DealCategoryFilter, number> = {
			all: allDeals.length,
			Grains: 0,
			Oilseeds: 0,
			Pulses: 0,
			'Processed Foods': 0,
		};
		for (const deal of allDeals) {
			counts[deal.category] += 1;
		}
		return counts;
	}, [allDeals]);
	const categoryFilterOptions: { value: DealCategoryFilter; label: string }[] = [
		{ value: 'all', label: `${tr.filterAll} (${categoryCounts.all})` },
		{ value: 'Grains', label: `${tr.filterGrains} (${categoryCounts.Grains})` },
		{
			value: 'Oilseeds',
			label: `${tr.filterOilseeds} (${categoryCounts.Oilseeds})`,
		},
		{ value: 'Pulses', label: `${tr.filterPulses} (${categoryCounts.Pulses})` },
		{
			value: 'Processed Foods',
			label: `${tr.filterProcessed} (${categoryCounts['Processed Foods']})`,
		},
	];

	return (
		<div className="app">

			<a href="#main-content" className="skip-link">
				{tr.skipToContent}
			</a>
			<AppNavigation
				labels={tr}
				lang={lang}
				view={view}
				onLanguageToggle={() => setLang(x => (x === 'bg' ? 'en' : 'bg'))}
				onViewChange={setView}
			/>

			<main id="main-content" className="app-main" tabIndex={-1}>
			{view === 'landing' && (
				<section className="section hero">
					<div className="hero-dashboard">
						<div className="hero-copy">
							<p className="section-kicker">{tr.marketPulse}</p>
							<h1 className="brand-wordmark">
								<span className="brand-agri">Agri</span>
								<span className="brand-nexus">Nexus</span>
							</h1>
							<p>{tr.heroSub}</p>
							<div className="hero-actions">
								<button className="btn btn-primary" onClick={() => setView('register')}>
									{tr.createAccount}
								</button>
								<button type="button" className="btn btn-outline" onClick={() => setView('automation')}>
									<RefreshCw size={16} aria-hidden /> {tr.navAutomation}
								</button>
							</div>
						</div>
						<div className="hero-metrics" aria-label={tr.marketPulse}>
							<div className="metric-tile">
								<span>{tr.activeOpps}</span>
								<strong>{filteredDeals.length}</strong>
								<small>{tr.livePreview}</small>
							</div>
							<div className="metric-tile">
								<span>{tr.grainInsightBuy}</span>
								<strong>{grainInsights.buyCount}</strong>
								<small>{tr.decision}</small>
							</div>
							<div className="metric-tile">
								<span>{tr.cabinetAlertsCount}</span>
								<strong>{alertsEnabledIds.length}</strong>
								<small>{tr.alertThreshold}: {alertThreshold}%</small>
							</div>
						</div>
					</div>

					<div className="ai-grid">
						{landingAiCards.map(f => {
							const Icon = f.icon;
							return (
								<div className="ai-card" key={f.title}>
									<Icon color="#22c55e" size={20} />
									<h4>{f.title}</h4>
									<p>{f.text}</p>
								</div>
							);
						})}
					</div>

					<div className="hero-preview-title">
						<p className="section-kicker">
							{tr.livePreview}
						</p>
						<h2>{tr.activeOpps}</h2>
						<p className="muted" style={{ marginTop: 0 }}>
							{tr.liveDealsHint}
						</p>
					</div>

					<div className="preview-mask">
						<div className="deals-track">
							{[...PREVIEW_DEALS, ...PREVIEW_DEALS].map((deal, idx) => (
								<div
									key={`${deal.id}-${idx}`}
									className="deal-card"
									style={{ width: 260, flexShrink: 0, position: 'relative' }}>
									<span className="demo-pill">{tr.demoBadge}</span>
									<div
										style={{
											display: 'flex',
											justifyContent: 'space-between',
											marginBottom: 8,
										}}>
										<span
											style={{
												fontSize: '.74rem',
												background: deal.isMENA ? '#b45309' : '#1d4ed8',
												borderRadius: 8,
												padding: '4px 8px',
											}}>
											{deal.flag} {deal.isMENA ? tr.menaBadge : tr.euBadge}
										</span>
										<strong style={{ color: '#22c55e' }}>
											+{deal.profit}%
										</strong>
									</div>
									<h3 style={{ margin: '0 0 8px' }}>{deal.product}</h3>
									<div
										className="muted"
										style={{
											background: '#0b1221',
											padding: 8,
											borderRadius: 8,
											fontSize: '.84rem',
										}}>
										<div>📦 {deal.packaging}</div>
										<div style={{ color: '#22c55e', marginTop: 4 }}>
											📜 {deal.certification}
										</div>
									</div>
									<div
										className="muted"
										style={{ marginTop: 8, fontSize: '.84rem' }}>
										{deal.from} → {deal.to}
									</div>
									<div style={{ marginTop: 8, fontWeight: 900 }}>
										{deal.price}
									</div>
								</div>
							))}
						</div>
					</div>

					<div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
						<button type="button" className="btn btn-outline" onClick={() => setView('market')}>
							{tr.openMarketplace}
						</button>
						<button type="button" className="btn btn-outline" onClick={() => setView('assistant')}>
							<Brain size={16} aria-hidden /> {tr.navAssistant}
						</button>
						<button type="button" className="btn btn-outline" onClick={() => setView('clients')}>
							{tr.clientDossiers}
						</button>
					</div>

					<div className="contact-panel" style={{ marginTop: 28, textAlign: 'left' }}>
						<h3 style={{ marginTop: 0 }}>{tr.contactSales}</h3>
						<p className="muted" style={{ marginTop: 6 }}>
							{tr.contactHelp}
						</p>
						<div className="form-grid" style={{ marginTop: 12 }}>
							<input
								placeholder={tr.phName}
								value={contactName}
								onChange={e => setContactName(e.target.value)}
							/>
							<input
								placeholder={tr.phEmail}
								value={contactEmail}
								onChange={e => setContactEmail(e.target.value)}
							/>
							{showContactEmailError && (
								<p
									style={{
										gridColumn: '1 / -1',
										margin: '-6px 0 0',
										color: '#f87171',
										fontSize: '.84rem',
									}}>
									{invalidEmailText}
								</p>
							)}
							<input
								placeholder={tr.phCompany}
								value={contactCompany}
								onChange={e => setContactCompany(e.target.value)}
							/>
							<textarea
								placeholder={tr.phMessage}
								rows={3}
								value={contactBody}
								onChange={e => setContactBody(e.target.value)}
								style={{ gridColumn: '1 / -1' }}
							/>
						</div>
						<div style={{ marginTop: 10 }}>
							<button
								className="btn btn-primary"
								disabled={
									contactStatus === 'loading' ||
									!contactEmail.trim() ||
									!contactBody.trim()
								}
								onClick={() => void submitContact()}>
								{contactStatus === 'loading' ? (
									<Loader2 className="spin" size={18} />
								) : (
									<Mail size={18} />
								)}{' '}
								{tr.send}
							</button>
							{contactFeedback && (
								<p
									className={contactStatus === 'ok' ? 'green-note' : 'muted'}
									style={{ marginTop: 10 }}>
									{contactFeedback}
								</p>
							)}
						</div>
					</div>

					<FileUploadPanel senderEmail={contactEmail} lang={lang} />
				</section>
			)}

			{view === 'market' && (
				<section className="section">
					<div className="market-head">
						<div className="search-wrap">
							<Search className="search-icon" size={18} />
							<input
								type="text"
								placeholder={tr.searchPh}
								value={searchQuery}
								onChange={e => setSearchQuery(e.target.value)}
							/>
						</div>
						<div
							style={{
								color: '#22c55e',
								fontWeight: 700,
								display: 'flex',
								alignItems: 'center',
								gap: 12,
								flexWrap: 'wrap',
							}}>
							<button
								type="button"
								className="btn-mini"
								onClick={() => forceRefreshDeals()}>
								<RefreshCw size={16} />
							</button>
							<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
								<RefreshCw size={16} />
								{tr.aiUpdateIn} {formatTime}
							</span>
						</div>
					</div>
					<div className="demo-banner" role="note">
						{quotesLoading && marketQuotes === null ? (
							<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
								<Loader2 className="spin" size={16} /> {marketBannerMessage}
							</span>
						) : (
							marketBannerMessage
						)}
					</div>
					<div className="deal-actions" style={{ margin: '2px 0 14px' }}>
						{categoryFilterOptions.map(option => (
							<button
								key={option.value}
								type="button"
								className={`deal-chip-btn ${selectedCategory === option.value ? 'active' : ''}`}
								onClick={() => setSelectedCategory(option.value)}>
								{option.label}
							</button>
						))}
					</div>
					<div className="contact-panel" style={{ marginTop: 0, marginBottom: 12 }}>
						<h3 style={{ margin: '0 0 8px' }}>{tr.grainInsightTitle}</h3>
						<div
							style={{
								display: 'grid',
								gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
								gap: 8,
							}}>
							<div className="meta-kv">
								<strong>{tr.grainInsightDeals}</strong>
								<p className="muted" style={{ margin: '6px 0 0' }}>
									{grainInsights.count}
								</p>
							</div>
							<div className="meta-kv">
								<strong>{tr.grainInsightAvgMargin}</strong>
								<p className="muted" style={{ margin: '6px 0 0' }}>
									{grainInsights.avgMargin}%
								</p>
							</div>
							<div className="meta-kv">
								<strong>{tr.grainInsightBuy}</strong>
								<p className="muted" style={{ margin: '6px 0 0' }}>
									{grainInsights.buyCount}
								</p>
							</div>
							<div className="meta-kv">
								<strong>{tr.grainInsightTopProduct}</strong>
								<p className="muted" style={{ margin: '6px 0 0' }}>
									{grainInsights.topProduct}
								</p>
							</div>
							<div className="meta-kv" style={{ gridColumn: '1 / -1' }}>
								<strong>{tr.grainInsightTopRoute}</strong>
								<p className="muted" style={{ margin: '6px 0 0' }}>
									{grainInsights.topRoute}
								</p>
							</div>
						</div>
					</div>

					<div className="ticker-wrap">
						<div className="ticker-track">
							{[...tickerItems, ...tickerItems].map((deal, idx) => (
								<span key={`${deal.id}-tk-${idx}`} className="ticker-item">
									#{deal.id} {deal.product}
									<strong>+{deal.profit}%</strong> · {deal.from} → {deal.to}
								</span>
							))}
						</div>
					</div>

					<div className="terminal-strip">
						{topMovers.map(deal => (
							<div key={deal.id} className="terminal-metric">
								<strong>
									{deal.product.length > 26
										? `${deal.product.slice(0, 26)}…`
										: deal.product}
								</strong>
								<span>
									{tr.terminalVol}: {deal.volatility} · Δ{' '}
									{deal.profit - deal.prevProfit >= 0 ? '+' : ''}
									{deal.profit - deal.prevProfit}%
								</span>
							</div>
						))}
					</div>

					<div className="pulse-toolbar">
						<p className="market-flash-line">
							<span className="live-dot" />
							{tr.marketPulse}:{' '}
							{marketFlashLines[marketFlashIndex % marketFlashLines.length]}
						</p>
						<label
							className="muted"
							style={{
								fontSize: '.82rem',
								display: 'flex',
								alignItems: 'center',
								gap: 6,
							}}>
							<input
								type="checkbox"
								checked={alertsMuted}
								onChange={e => setAlertsMuted(e.target.checked)}
							/>
							{tr.alertMute}
						</label>
						<label
							className="muted"
							style={{
								fontSize: '.82rem',
								display: 'flex',
								alignItems: 'center',
								gap: 8,
							}}>
							{tr.alertThreshold}
							<input
								type="number"
								min={5}
								max={45}
								value={alertThreshold}
								onChange={e => setAlertThreshold(Number(e.target.value))}
								style={{
									width: 56,
									padding: '4px 6px',
									borderRadius: 8,
									border: '1px solid #334155',
									background: '#0f172a',
									color: '#fff',
								}}
							/>
						</label>
					</div>

					<div className="grid">
						{filteredDeals.map((deal, i) => {
							const isLocked = !isPremium && i >= FREE_MARKET_DEALS_FOR_GUEST;
							const delta = deal.profit - deal.prevProfit;
							return (
								<div className={`deal-card ${i < 8 ? 'top' : ''}`} key={deal.id}>
									<div
										style={{
											filter: isLocked ? 'blur(7px)' : 'none',
											opacity: isLocked ? 0.35 : 1,
										}}>
										<div
											style={{
												display: 'flex',
												justifyContent: 'space-between',
												marginBottom: 8,
											}}>
											<span
												style={{
													fontSize: '.75rem',
													background: deal.isMENA ? '#f59e0b' : '#3b82f6',
													borderRadius: 6,
													padding: '3px 9px',
												}}>
												{deal.flag} {deal.isMENA ? 'MENA' : 'EU'}
											</span>
											<strong style={{ color: '#22c55e' }}>
												+{deal.profit}%
											</strong>
										</div>
										<h3 style={{ margin: '0 0 6px' }}>{deal.product}</h3>
										<div className="muted" style={{ fontSize: '.84rem' }}>
											{deal.from} → {deal.to}
										</div>
										<div
											className="muted"
											style={{
												background: '#0b1221',
												marginTop: 8,
												borderRadius: 8,
												padding: 8,
												fontSize: '.84rem',
											}}>
											<div>📦 {deal.packaging}</div>
											<div style={{ color: '#22c55e', marginTop: 3 }}>
												📜 {deal.certification}
											</div>
											<div style={{ marginTop: 3 }}>
												🏷️ {tr.dealCategory}: {deal.category}
											</div>
											<div style={{ marginTop: 3 }}>
												🧪 {tr.dealQuality}: {deal.qualitySpec}
											</div>
											<div style={{ marginTop: 3 }}>
												📦 {tr.dealVolume}: {deal.availableVolume}
											</div>
											<div style={{ marginTop: 3 }}>
												🚢 {tr.dealIncoterm}: {deal.incoterm}
											</div>
											<div style={{ marginTop: 3 }}>
												📅 {tr.dealDelivery}: {deal.deliveryWindow}
											</div>
										</div>
										<div
											className="muted"
											style={{ fontSize: '.8rem', marginTop: 6 }}>
											{tr.terminalVol}: {deal.volatility} · Δ{' '}
											{delta >= 0 ? '+' : ''}
											{delta}%
										</div>
										<div style={{ marginTop: 8, fontSize: '.86rem' }}>
											{tr.decision}:{' '}
											<strong
												style={{
													color:
														deal.decision === 'BUY'
															? '#22c55e'
															: deal.decision === 'HOLD'
																? '#f59e0b'
																: '#ef4444',
												}}>
												{deal.decision}
											</strong>
										</div>
										<div className="muted" style={{ fontSize: '.84rem' }}>
											{tr.estMargin}: {deal.margin}%
										</div>
										<div style={{ marginTop: 8, fontWeight: 900 }}>
											{deal.price}
										</div>
										{!isLocked && (
											<div className="deal-actions">
												<button
													type="button"
													className={`deal-chip-btn ${watchlistIds.includes(deal.id) ? 'active' : ''}`}
													onClick={() => toggleWatchlist(deal.id)}>
													{watchlistIds.includes(deal.id)
														? tr.watchSaved
														: tr.watchSave}
												</button>
												<button
													type="button"
													className={`deal-chip-btn ${alertsEnabledIds.includes(deal.id) ? 'active' : ''}`}
													onClick={() => toggleAlert(deal.id)}>
													{alertsEnabledIds.includes(deal.id)
														? tr.alertOn
														: tr.alertOff}
													{!alertsMuted && deal.profit >= alertThreshold
														? ' ●'
														: ''}
												</button>
											</div>
										)}
									</div>

									{isLocked && (
										<div className="locked-overlay">
											<Lock color="#22c55e" size={24} aria-hidden />
											<button
												type="button"
												className="btn btn-primary"
												onClick={() => setView('pricing')}>
												{tr.unlock}
											</button>
											<p
												style={{
													margin: 0,
													textAlign: 'center',
													fontSize: '.78rem',
													color: '#cbd5e1',
													maxWidth: 220,
													lineHeight: 1.35,
												}}>
												{tr.unlockSub}
											</p>
										</div>
									)}
								</div>
							);
						})}
					</div>

					<div className="contact-panel">
						<h3 style={{ margin: 0 }}>{tr.coverageTitle}</h3>
						<p className="muted" style={{ margin: '8px 0 0' }}>
							{tr.coverageBody}
						</p>
					</div>
				</section>
			)}

			{view === 'assistant' && (
				<section className="section">
					<button
						type="button"
						className="btn btn-outline"
						style={{ marginBottom: 14 }}
						onClick={() => setView('market')}>
						<ArrowLeft size={16} aria-hidden /> {tr.assistantBack}
					</button>
					<h2 style={{ margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
						<MessageSquare color="#22c55e" size={26} aria-hidden />
						{tr.assistantTitle}
					</h2>
					<p className="muted" style={{ margin: '0 0 14px', maxWidth: 720 }}>
						{tr.assistantSubtitle}
					</p>
					<div className="contact-panel">
						<div className="chat-actions" style={{ marginBottom: 8 }}>
							<span className="muted" style={{ fontSize: '.8rem' }}>
								{tr.chatPromptsLabel}
							</span>
							<button type="button" className="btn-mini" onClick={() => setChatMessages([])}>
								{tr.chatClear}
							</button>
						</div>
						<div className="deal-actions" style={{ marginBottom: 10 }}>
							{quickPrompts.map(prompt => (
								<button
									key={prompt}
									type="button"
									className="deal-chip-btn"
									onClick={() => applyQuickPrompt(prompt)}>
									{prompt}
								</button>
							))}
						</div>
						<div className="assistant-msgs">
							{chatMessages.map((m, idx) => (
								<div key={`${idx}-${m.role}`} className={`assistant-bubble ${m.role}`}>
									{m.content}
								</div>
							))}
							{chatLoading && (
								<div
									className="assistant-bubble assistant"
									style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
									<Loader2 size={16} className="spin" aria-hidden /> {tr.chatThinking}
								</div>
							)}
							<div ref={chatEndRef} />
						</div>
						<div className="assistant-input-row">
							<textarea
								placeholder={tr.chatPlaceholder}
								value={chatInput}
								onChange={e => setChatInput(e.target.value)}
								onKeyDown={e => {
									if (e.key === 'Enter' && !e.shiftKey) {
										e.preventDefault();
										void sendChat();
									}
								}}
							/>
							<button
								type="button"
								className="btn btn-primary"
								disabled={chatLoading}
								onClick={() => void sendChat()}>
								<Send size={18} aria-hidden />
							</button>
						</div>
						<p className="muted" style={{ margin: '14px 0 0', fontSize: '.78rem', lineHeight: 1.45 }}>
							{tr.assistantLegalFooter}
						</p>
					</div>
				</section>
			)}

			{view === 'automation' && (
				<section className="section">
					<div className="automation-hero">
						<div>
							<p className="section-kicker">{tr.navAutomation}</p>
							<h2>{tr.automationTitle}</h2>
							<p className="muted">{tr.automationSubtitle}</p>
						</div>
						<button type="button" className="btn btn-primary" onClick={() => setView('watchlist')}>
							<RefreshCw size={18} aria-hidden /> {tr.automationCta}
						</button>
					</div>

					<div className="automation-layout">
						<div className="contact-panel automation-lead">
							<h3>{tr.automationLeadTitle}</h3>
							<p className="muted">{tr.automationLeadBody}</p>
							<div className="automation-flow">
								<div className="automation-step">
									<span>01</span>
									<strong>{tr.automationStep1}</strong>
									<p>{tr.automationStep1Body}</p>
								</div>
								<div className="automation-step">
									<span>02</span>
									<strong>{tr.automationStep2}</strong>
									<p>{tr.automationStep2Body}</p>
								</div>
								<div className="automation-step">
									<span>03</span>
									<strong>{tr.automationStep3}</strong>
									<p>{tr.automationStep3Body}</p>
								</div>
							</div>
						</div>
						<div className="contact-panel automation-ops">
							<h3>{tr.automationOpsTitle}</h3>
							<ul>
								<li>{tr.automationOps1}</li>
								<li>{tr.automationOps2}</li>
								<li>{tr.automationOps3}</li>
								<li>{tr.automationOps4}</li>
							</ul>
						</div>
					</div>
				</section>
			)}

			{view === 'watchlist' && (
				<section className="section">
					<h2 style={{ marginTop: 0 }}>{tr.watchlistTitle}</h2>
					<div className="deal-actions" style={{ margin: '4px 0 14px' }}>
						<button
							type="button"
							className={`deal-chip-btn ${watchlistPanel === 'saved' ? 'active' : ''}`}
							onClick={() => setWatchlistPanel('saved')}>
							{tr.watchlistTabSaved}
						</button>
						<button
							type="button"
							className={`deal-chip-btn ${watchlistPanel === 'cabinet' ? 'active' : ''}`}
							onClick={() => setWatchlistPanel('cabinet')}>
							{tr.watchlistTabCabinet}
						</button>
					</div>
					{watchlistPanel === 'saved' ? (
						watchedDeals.length === 0 ? (
							<div>
								<p className="muted">{tr.watchlistEmpty}</p>
								<p className="muted" style={{ marginTop: 10, fontSize: '.86rem' }}>
									{tr.watchlistStorageHint}
								</p>
							</div>
						) : (
							<div className="grid">
								{watchedDeals.map(deal => {
									const delta = deal.profit - deal.prevProfit;
									return (
										<div className="deal-card top" key={`w-${deal.id}`}>
											<div
												style={{
													display: 'flex',
													justifyContent: 'space-between',
													marginBottom: 8,
												}}>
												<span
													style={{
														fontSize: '.75rem',
														background: deal.isMENA ? '#f59e0b' : '#3b82f6',
														borderRadius: 6,
														padding: '3px 9px',
													}}>
													{deal.flag} {deal.isMENA ? 'MENA' : 'EU'}
												</span>
												<strong style={{ color: '#22c55e' }}>
													+{deal.profit}%
												</strong>
											</div>
											<h3 style={{ margin: '0 0 6px' }}>{deal.product}</h3>
											<div className="muted" style={{ fontSize: '.84rem' }}>
												{deal.from} → {deal.to}
											</div>
											<div
												className="muted"
												style={{
													background: '#0b1221',
													marginTop: 8,
													borderRadius: 8,
													padding: 8,
													fontSize: '.84rem',
												}}>
												<div>📦 {deal.packaging}</div>
												<div style={{ color: '#22c55e', marginTop: 3 }}>
													📜 {deal.certification}
												</div>
												<div style={{ marginTop: 3 }}>
													🏷️ {tr.dealCategory}: {deal.category}
												</div>
												<div style={{ marginTop: 3 }}>
													🧪 {tr.dealQuality}: {deal.qualitySpec}
												</div>
												<div style={{ marginTop: 3 }}>
													📦 {tr.dealVolume}: {deal.availableVolume}
												</div>
												<div style={{ marginTop: 3 }}>
													🚢 {tr.dealIncoterm}: {deal.incoterm}
												</div>
												<div style={{ marginTop: 3 }}>
													📅 {tr.dealDelivery}: {deal.deliveryWindow}
												</div>
											</div>
											<div
												className="muted"
												style={{ fontSize: '.8rem', marginTop: 6 }}>
												{tr.terminalVol}: {deal.volatility} · Δ{' '}
												{delta >= 0 ? '+' : ''}
												{delta}%
											</div>
											<div style={{ marginTop: 8, fontWeight: 900 }}>
												{deal.price}
											</div>
											<div className="deal-actions">
												<button
													type="button"
													className="deal-chip-btn active"
													onClick={() => toggleWatchlist(deal.id)}>
													{tr.watchSaved}
												</button>
												<button
													type="button"
													className={`deal-chip-btn ${alertsEnabledIds.includes(deal.id) ? 'active' : ''}`}
													onClick={() => toggleAlert(deal.id)}>
													{alertsEnabledIds.includes(deal.id)
														? tr.alertOn
														: tr.alertOff}
												</button>
											</div>
										</div>
									);
								})}
							</div>
						)
					) : (
						<div className="contact-panel">
							<h3 style={{ margin: '0 0 8px' }}>{tr.cabinetTitle}</h3>
							<p className="muted" style={{ marginTop: 0 }}>
								{tr.cabinetSubtitle}
							</p>
							<div
								style={{
									display: 'grid',
									gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
									gap: 8,
									marginBottom: 12,
								}}>
								<div className="meta-kv">
									<strong>{tr.cabinetSavedCount}</strong>
									<p className="muted" style={{ margin: '6px 0 0' }}>
										{watchedDeals.length}
									</p>
								</div>
								<div className="meta-kv">
									<strong>{tr.cabinetAlertsCount}</strong>
									<p className="muted" style={{ margin: '6px 0 0' }}>
										{alertsEnabledIds.length}
									</p>
								</div>
								<div className="meta-kv">
									<strong>{tr.cabinetLastSaved}</strong>
									<p className="muted" style={{ margin: '6px 0 0' }}>
										{lastSavedDeal
											? `#${lastSavedDeal.id} ${lastSavedDeal.product}`
											: tr.cabinetNoActivity}
									</p>
								</div>
								<div className="meta-kv">
									<strong>{tr.cabinetLastAlert}</strong>
									<p className="muted" style={{ margin: '6px 0 0' }}>
										{lastAlertDeal
											? `#${lastAlertDeal.id} ${lastAlertDeal.product}`
											: tr.cabinetNoActivity}
									</p>
								</div>
							</div>
							<div className="deal-actions">
								<button type="button" className="deal-chip-btn" onClick={() => setView('market')}>
									{tr.cabinetGoMarket}
								</button>
								<button type="button" className="deal-chip-btn" onClick={() => setView('clients')}>
									{tr.cabinetGoClients}
								</button>
								<button type="button" className="deal-chip-btn" onClick={() => setView('company')}>
									{tr.cabinetGoCompany}
								</button>
								<button type="button" className="deal-chip-btn" onClick={() => setView('pricing')}>
									{tr.cabinetGoPricing}
								</button>
							</div>
						</div>
					)}
				</section>
			)}

			{view === 'pricing' && (
				<section className="section">
					<h2 style={{ textAlign: 'center', marginBottom: 16 }}>{tr.pricingTitle}</h2>
					<div style={{ textAlign: 'center', marginBottom: 14 }}>
						<span className="chip chip-demo" style={{ marginRight: 8 }}>
							{tr.pricingBetaBadge}
						</span>
						<span className="muted">{tr.pricingBetaNote}</span>
					</div>
					<div className="pricing-grid">
						<PricingCard
							title={tr.pricingWeekly}
							price="12"
							period={tr.pricingWeek}
							popular
							badgeText={tr.pricingRecommendedStart}
							lang={lang}
							labels={{
								bestValue: tr.pricingBestValue,
								subscribe: tr.pricingSubscribe,
								per: tr.pricingPer,
							}}
						/>
						<PricingCard
							title={tr.pricingMonthly}
							price="29"
							period={tr.pricingMonth}
							lang={lang}
							labels={{
								bestValue: tr.pricingBestValue,
								subscribe: tr.pricingSubscribe,
								per: tr.pricingPer,
							}}
						/>
						<PricingCard
							title={tr.pricingYearly}
							price="249"
							period={tr.pricingYear}
							note={tr.pricingYearlyNote}
							lang={lang}
							labels={{
								bestValue: tr.pricingBestValue,
								subscribe: tr.pricingSubscribe,
								per: tr.pricingPer,
							}}
						/>
					</div>
					<div className="pricing-message-grid">
						<div className="contact-panel pricing-value-panel">
							<h3 className="pricing-value-title">{tr.pricingConceptTitle}</h3>
							<p className="pricing-value-body">{tr.pricingConceptBody}</p>
						</div>
						<div className="contact-panel pricing-value-panel">
							<h3 className="pricing-value-title">{tr.pricingPlanExplainTitle}</h3>
							<p className="pricing-value-body">{tr.pricingPlanExplainBody}</p>
						</div>
						<div className="contact-panel pricing-value-panel">
							<h3 className="pricing-value-title">{tr.pricingResultTitle}</h3>
							<p className="pricing-value-body">{tr.pricingResultBody}</p>
						</div>
					</div>
					<div className="contact-panel">
						<p style={{ margin: 0 }}>
							{tr.pricingContactLead}{' '}
							<a
								href="mailto:info@agrinexus.eu"
								style={{ color: '#22c55e', textDecoration: 'none' }}>
								info@agrinexus.eu
							</a>{' '}
							— {tr.pricingContactText}
						</p>
					</div>
					<div className="pricing-bottom-grid">
						<div className="contact-panel">
							<h3 style={{ marginTop: 0 }}>{tr.pricingFaqTitle}</h3>
							<div style={{ display: 'grid', gap: 10 }}>
								<div>
									<strong>{tr.pricingFaqQ1}</strong>
									<p className="muted" style={{ margin: '6px 0 0' }}>
										{tr.pricingFaqA1}
									</p>
								</div>
								<div>
									<strong>{tr.pricingFaqQ2}</strong>
									<p className="muted" style={{ margin: '6px 0 0' }}>
										{tr.pricingFaqA2}
									</p>
								</div>
								<div>
									<strong>{tr.pricingFaqQ3}</strong>
									<p className="muted" style={{ margin: '6px 0 0' }}>
										{tr.pricingFaqA3}
									</p>
								</div>
							</div>
						</div>
						<div className="contact-panel pricing-brand-panel">
							<p className="pricing-brand-head">
								<Leaf size={24} color="var(--green)" />
								<span className="brand-wordmark">
									<span className="brand-agri">Agri</span>
									<span className="brand-nexus">Nexus</span>
								</span>
							</p>
							<p className="pricing-brand-motto">{tr.pricingBrandMotto}</p>
						</div>
					</div>
				</section>
			)}

			{view === 'register' && (
				<section className="section">
					<h2>{tr.registerTitle}</h2>
					<p className="muted">{tr.registerSubtitle}</p>
					<div className="form-grid">
						<input
							placeholder={tr.fullNamePh}
							value={regFullName}
							onChange={e => setRegFullName(e.target.value)}
						/>
						<input
							placeholder={tr.companyNamePh}
							value={regCompany}
							onChange={e => setRegCompany(e.target.value)}
						/>
						<input
							placeholder={tr.businessEmailPh}
							value={regEmail}
							onChange={e => setRegEmail(e.target.value)}
						/>
						{showRegisterEmailError && (
							<p
								style={{
									gridColumn: '1 / -1',
									margin: '-6px 0 0',
									color: '#f87171',
									fontSize: '.84rem',
								}}>
								{invalidEmailText}
							</p>
						)}
						<input
							placeholder={tr.passwordPh}
							type="password"
							value={regPassword}
							onChange={e => setRegPassword(e.target.value)}
						/>
						<select value={regMarket} onChange={e => setRegMarket(e.target.value)}>
							<option value="" disabled>
								{tr.marketFocusPh}
							</option>
							<option value="Europe">{tr.marketEurope}</option>
							<option value="MENA">{tr.marketMena}</option>
							<option value="Both">{tr.marketBoth}</option>
						</select>
						<input
							placeholder={tr.phonePh}
							value={regPhone}
							inputMode="tel"
							autoComplete="tel"
							maxLength={16}
							onChange={e => setRegPhone(formatPhoneInput(e.target.value))}
						/>
						<p
							className="muted"
							style={{
								gridColumn: '1 / -1',
								margin: '-6px 0 0',
								fontSize: '.82rem',
							}}>
							{phoneHelperText}
						</p>
						{showRegisterPhoneError && (
							<p
								style={{
									gridColumn: '1 / -1',
									margin: '-6px 0 0',
									color: '#f87171',
									fontSize: '.84rem',
								}}>
								{invalidPhoneText}
							</p>
						)}
					</div>
					<div style={{ marginTop: 10 }}>
						<label className="muted" style={{ fontSize: '.92rem' }}>
							<input
								type="checkbox"
								checked={regSubscribe}
								style={{ marginRight: 8 }}
								onChange={e => setRegSubscribe(e.target.checked)}
							/>
							{tr.agreeUpdates}
						</label>
					</div>
					<div
						style={{
							marginTop: 12,
							display: 'flex',
							gap: 8,
							flexWrap: 'wrap',
							alignItems: 'center',
						}}>
						<button
							className="btn btn-primary"
							disabled={regStatus === 'loading' || !canSubmitRegister}
							onClick={() => void submitRegister()}>
							{regStatus === 'loading' ? <Loader2 size={18} /> : null}{' '}
							{tr.createMyAccount}
						</button>
						<button className="btn btn-outline" onClick={() => setView('login')}>
							{tr.alreadyHaveAccount}
						</button>
						{regMsg && (
							<span
								className={regStatus === 'ok' ? 'green-note' : 'muted'}
								style={{ width: '100%' }}>
								{regMsg}
							</span>
						)}
					</div>
				</section>
			)}

			{view === 'login' && (
				<section className="section">
					<h2>{tr.loginTitle}</h2>
					<p className="muted">{tr.loginSubtitle}</p>
					<div className="form-grid">
						<input placeholder={tr.loginEmailPh} />
						<input type="password" placeholder={tr.loginPasswordPh} />
					</div>
					<div style={{ marginTop: 12 }}>
						<button className="btn btn-primary" onClick={handleDemoSignIn}>
							{tr.loginBtn}
						</button>
					</div>
				</section>
			)}

			{view === 'company' && (
				<section className="section">
					<h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
						<Building2 size={22} color="#22c55e" /> {tr.companyTitle}
					</h2>
					<p className="muted">{tr.companySubtitle}</p>
					<div className="contact-panel">
						<p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
							<Globe2 size={16} color="#22c55e" /> {tr.companyRegions}
						</p>
						<p
							style={{
								margin: '8px 0 0',
								display: 'flex',
								alignItems: 'center',
								gap: 8,
							}}>
							<Mail size={16} color="#22c55e" /> info@agrinexus.eu
						</p>
					</div>
				</section>
			)}

			{view === 'clients' && (
				<section className="section">
					<h2 style={{ marginTop: 0 }}>{tr.clientsTitle}</h2>
					<p className="muted" style={{ marginTop: 6 }}>
						{tr.clientsSubtitle}
					</p>
					<div className="clients-layout">
						<div className="client-list">
							{CLIENT_PROFILES.map(profile => {
								const profileLocalized =
									lang === 'bg'
										? { ...profile, ...CLIENT_PROFILE_BG_COPY[profile.id] }
										: profile;
								return (
									<button
										key={profile.id}
										className={`client-list-item ${selectedClient.id === profile.id ? 'active' : ''}`}
										onClick={() => setSelectedClientId(profile.id)}>
										<strong>{profile.company}</strong>
										<div
											className="muted"
											style={{ marginTop: 4, fontSize: '.82rem' }}>
											{profile.contactPerson} · {profileLocalized.region}
										</div>
									</button>
								);
							})}
						</div>
						<div className="client-card">
							<h3
								style={{
									marginTop: 0,
									display: 'flex',
									justifyContent: 'space-between',
									alignItems: 'center',
								}}>
								<span>{selectedClientLocalized.company}</span>
								<span className="status-pill">{selectedClientStatusLabel}</span>
							</h3>
							<p className="muted" style={{ marginTop: 0 }}>
								{selectedClientLocalized.role} · {selectedClientLocalized.contactPerson}
							</p>
							<div className="client-meta-grid">
								<div className="meta-kv">
									<strong>{tr.clientContact}</strong>
									<p className="muted" style={{ margin: '8px 0 0' }}>
										{selectedClientLocalized.email}
										<br />
										{selectedClientLocalized.phone}
									</p>
								</div>
								<div className="meta-kv">
									<strong>{tr.clientMarketFocus}</strong>
									<p className="muted" style={{ margin: '8px 0 0' }}>
										{selectedClientLocalized.focus}
									</p>
								</div>
								<div className="meta-kv">
									<strong>{tr.clientCertifications}</strong>
									<p className="muted" style={{ margin: '8px 0 0' }}>
										{selectedClientLocalized.certifications.join(', ')}
									</p>
								</div>
								<div className="meta-kv">
									<strong>{tr.clientIncoterms}</strong>
									<p className="muted" style={{ margin: '8px 0 0' }}>
										{selectedClientLocalized.preferredIncoterms.join(', ')}
									</p>
								</div>
								<div className="meta-kv">
									<strong>{tr.clientMonthlyVolume}</strong>
									<p className="muted" style={{ margin: '8px 0 0' }}>
										{selectedClientLocalized.monthlyVolume}
									</p>
								</div>
								<div className="meta-kv">
									<strong>{tr.clientInternalNotes}</strong>
									<p className="muted" style={{ margin: '8px 0 0' }}>
										{selectedClientLocalized.notes}
									</p>
								</div>
							</div>
							<div className="contact-panel" style={{ marginTop: 14 }}>
								<p style={{ margin: 0 }}>
									{tr.clientCardLabel}: <strong>{selectedClientLocalized.company}</strong>{' '}
									| {selectedClientLocalized.contactPerson} | {selectedClientLocalized.email}
								</p>
							</div>
						</div>
					</div>
				</section>
			)}
			</main>

			{isMobileViewport && <MobileNavigation labels={tr} view={view} onViewChange={setView} />}
		</div>
	);
}

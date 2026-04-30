import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Lucide from 'lucide-react';
import FileUploadPanel from './FileUploadPanel';
const {
	Leaf,
	Search,
	Lock,
	MessageSquare,
	RefreshCw,
	CreditCard,
	X,
	Bell,
	Brain,
	LineChart,
	Mail,
	UserPlus,
	LogIn,
	Building2,
	Globe2,
	Send,
	Loader2,
} = Lucide;

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
		locked: false,
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
		locked: false,
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
		locked: true,
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
		locked: true,
	},
];

const AI_FEATURES = [
	{
		icon: Brain,
		title: 'BUY / HOLD / AVOID',
		text: 'AI trade logic makes decisions from real market signals and historical deals.',
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

function getDecisionByProfit(profit: number) {
	if (profit >= 21) return 'BUY';
	if (profit >= 13) return 'HOLD';
	return 'AVOID';
}

function getDecisionBySignals(input: {
	profit: number;
	volatility: 'LOW' | 'MED' | 'HIGH';
	category: DealRow['category'];
}): string {
	let score = input.profit;
	if (input.category === 'Grains') score -= 1;
	if (input.volatility === 'HIGH') score -= 2;
	else if (input.volatility === 'MED') score -= 1;
	return getDecisionByProfit(score);
}

function getVolatility(current: number, previous: number): 'LOW' | 'MED' | 'HIGH' {
	const delta = Math.abs(current - previous);
	if (delta >= 5) return 'HIGH';
	if (delta >= 3) return 'MED';
	return 'LOW';
}

type DealRow = {
	id: number;
	product: string;
	category: 'Grains' | 'Oilseeds' | 'Pulses' | 'Processed Foods';
	packaging: string;
	certification: string;
	qualitySpec: string;
	availableVolume: string;
	incoterm: string;
	deliveryWindow: string;
	from: string;
	to: string;
	flag: string;
	profit: number;
	margin: number;
	price: string;
	prevPrice: string;
	isMENA: boolean;
	decision: string;
	prevProfit: number;
	volatility: 'LOW' | 'MED' | 'HIGH';
};
type DealCategoryFilter = 'all' | DealRow['category'];
type SearchableDeal = DealRow & { searchText: string };
type WatchlistPanel = 'saved' | 'cabinet';

type ChatTurn = { role: 'user' | 'assistant'; content: string };
type Lang = 'bg' | 'en';
type View =
	| 'landing'
	| 'market'
	| 'pricing'
	| 'register'
	| 'login'
	| 'company'
	| 'clients'
	| 'watchlist';

type ClientProfile = {
	id: string;
	company: string;
	contactPerson: string;
	role: string;
	email: string;
	phone: string;
	region: string;
	focus: string;
	certifications: string[];
	preferredIncoterms: string[];
	monthlyVolume: string;
	creditStatus: 'Approved' | 'Pending' | 'Review';
	notes: string;
};

const QUICK_PROMPTS_BG = [
	'Дай BUY/HOLD/AVOID за домати България -> UAE.',
	'Кои сертификати са критични за export към KSA?',
	'Направи бърз risk-check за EU to MENA route.',
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

const QUICK_PROMPTS_EN = [
	'Give BUY/HOLD/AVOID for tomatoes Bulgaria → UAE.',
	'Which certifications matter most for export to KSA?',
	'Quick risk-check for EU to MENA route.',
];

const MARKET_FLASH_EN = [
	'Tomato paste corridor TR → KSA showing tighter spreads this session.',
	'Sunflower oil bids from Egypt remain strong for next 2 loading windows.',
	'Premium wheat routes into EU show HOLD bias due to freight pressure.',
];

const MARKET_FLASH_BG = [
	'Коридор доматено пюре TR → KSA: по-тесни спредове през тази сесия.',
	'Оферти за слънчогледово масло от Египет остават силни за следващите прозорци за товарене.',
	'Премиум пшенични маршрути към EU: склонност към HOLD заради натиск върху превоза.',
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
	lang,
	labels,
}: {
	title: string;
	price: string;
	period: string;
	note?: string;
	popular?: boolean;
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
			{popular && <div className="badge">{labels.bestValue}</div>}
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
			let data: { reply?: string; error?: string; hint?: string } = {};
			try {
				data = (await res.json()) as typeof data;
			} catch {
				throw new Error(
					locale === 'bg' ? 'Невалиден отговор от сървъра' : 'Invalid server response'
				);
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
		localStorage.getItem('agrinexus-lang') === 'en' ? 'en' : 'bg'
	);
	const [isPremium] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [selectedCategory, setSelectedCategory] = useState<DealCategoryFilter>('all');
	const [watchlistPanel, setWatchlistPanel] = useState<WatchlistPanel>('saved');
	const [isChatOpen, setIsChatOpen] = useState(false);
	const [hasUnreadChat, setHasUnreadChat] = useState(false);
	const [nextUpdate, setNextUpdate] = useState(30 * 60);
	const [refreshTick, setRefreshTick] = useState(0);
	const [marketFlashIndex, setMarketFlashIndex] = useState(0);
	const [selectedClientId, setSelectedClientId] = useState(CLIENT_PROFILES[0].id);
	const [chatMessages, setChatMessages] = useState<ChatTurn[]>([]);
	const [chatInput, setChatInput] = useState(
		() => sessionStorage.getItem('agrinexus-chat-draft') ?? ''
	);
	const [chatLoading, setChatLoading] = useState(false);
	const [chatKeyboardOffset, setChatKeyboardOffset] = useState(12);
	const [chatViewportHeight, setChatViewportHeight] = useState<number>(() => window.innerHeight);
	const chatBaseInnerHeightRef = useRef<number>(window.innerHeight);
	const [isMobileViewport, setIsMobileViewport] = useState(() =>
		typeof window !== 'undefined' ? window.matchMedia('(max-width: 900px)').matches : false
	);
	const chatAbortRef = useRef<AbortController | null>(null);
	const chatEndRef = useRef<HTMLDivElement | null>(null);
	const chatTextAreaRef = useRef<HTMLTextAreaElement | null>(null);

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
			const raw = localStorage.getItem('agrinexus-watchlist');
			return raw ? (JSON.parse(raw) as number[]) : [];
		} catch {
			return [];
		}
	});
	const [alertsEnabledIds, setAlertsEnabledIds] = useState<number[]>(() => {
		try {
			const raw = localStorage.getItem('agrinexus-alerts');
			return raw ? (JSON.parse(raw) as number[]) : [];
		} catch {
			return [];
		}
	});
	const [alertThreshold, setAlertThreshold] = useState<number>(() => {
		const raw = localStorage.getItem('agrinexus-alert-threshold');
		const value = raw ? Number(raw) : 20;
		return Number.isFinite(value) ? value : 20;
	});
	const [alertsMuted, setAlertsMuted] = useState<boolean>(
		() => localStorage.getItem('agrinexus-alerts-muted') === '1'
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

	const allDeals = useMemo(() => {
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
		return slice
			.map(
				d =>
					`#${d.id} ${d.product} | ${d.from}→${d.to} | ${d.decision} | est. +${d.profit}% | ${d.price}`
			)
			.join('\n');
	}, [filteredDeals]);

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
		localStorage.setItem('agrinexus-watchlist', JSON.stringify(watchlistIds));
	}, [watchlistIds]);

	useEffect(() => {
		localStorage.setItem('agrinexus-alerts', JSON.stringify(alertsEnabledIds));
	}, [alertsEnabledIds]);

	useEffect(() => {
		localStorage.setItem('agrinexus-lang', lang);
	}, [lang]);

	useEffect(() => {
		localStorage.setItem('agrinexus-alert-threshold', String(alertThreshold));
	}, [alertThreshold]);

	useEffect(() => {
		localStorage.setItem('agrinexus-alerts-muted', alertsMuted ? '1' : '0');
	}, [alertsMuted]);

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
		sessionStorage.removeItem('agrinexus-chat-draft');
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
					? 'AI чатът не е конфигуриран. Създай .env с OPENAI_API_KEY и пусни npm run dev (Vite + локален API). На Vercel добави ключа в Environment Variables.'
					: 'AI chat is not configured. Create .env with OPENAI_API_KEY and run npm run dev (Vite + local API). On Vercel add the key in Environment Variables.'
				: msg;
			setChatMessages(prev => [...prev, { role: 'assistant', content: normalized }]);
		} finally {
			if (chatAbortRef.current === controller) chatAbortRef.current = null;
			setChatLoading(false);
		}
	}, [chatInput, chatLoading, chatMessages, dealContextForAI, lang]);

	useEffect(() => {
		sessionStorage.setItem('agrinexus-chat-draft', chatInput);
	}, [chatInput]);

	useEffect(() => {
		if (!isChatOpen) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') setIsChatOpen(false);
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [isChatOpen]);

	useEffect(() => {
		chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
	}, [chatMessages, chatLoading, isChatOpen]);

	useEffect(() => {
		const last = chatMessages[chatMessages.length - 1];
		if (!last) return;
		if (last.role === 'assistant' && !isChatOpen) {
			setHasUnreadChat(true);
		}
	}, [chatMessages, isChatOpen]);

	useEffect(() => {
		const updateKeyboardOffset = () => {
			const viewport = window.visualViewport;
			const viewportHeight = viewport?.height ?? window.innerHeight;
			setChatViewportHeight(viewportHeight);
			if (!isMobileViewport) {
				setChatKeyboardOffset(12);
				return;
			}
			const keyboardHeightFromViewport = viewport
				? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
				: 0;
			const keyboardHeightFromInnerResize = Math.max(
				0,
				chatBaseInnerHeightRef.current - window.innerHeight
			);
			const keyboardHeight = Math.max(
				keyboardHeightFromViewport,
				keyboardHeightFromInnerResize
			);
			// Keep a small margin above mobile keyboard.
			setChatKeyboardOffset(keyboardHeight > 0 ? keyboardHeight + 10 : 12);
		};

		updateKeyboardOffset();
		window.addEventListener('resize', updateKeyboardOffset);
		window.visualViewport?.addEventListener('resize', updateKeyboardOffset);
		window.visualViewport?.addEventListener('scroll', updateKeyboardOffset);
		window.addEventListener('orientationchange', updateKeyboardOffset);

		return () => {
			window.removeEventListener('resize', updateKeyboardOffset);
			window.visualViewport?.removeEventListener('resize', updateKeyboardOffset);
			window.visualViewport?.removeEventListener('scroll', updateKeyboardOffset);
			window.removeEventListener('orientationchange', updateKeyboardOffset);
		};
	}, [isMobileViewport]);

	useEffect(() => {
		const media = window.matchMedia('(max-width: 900px)');
		const updateMobile = () => setIsMobileViewport(media.matches);
		updateMobile();
		media.addEventListener('change', updateMobile);
		return () => media.removeEventListener('change', updateMobile);
	}, []);

	useEffect(() => () => chatAbortRef.current?.abort(), []);

	useEffect(() => {
		if (!isChatOpen) return;
		const id = window.setTimeout(() => chatTextAreaRef.current?.focus(), 80);
		return () => clearTimeout(id);
	}, [isChatOpen]);

	useEffect(() => {
		const inputEl = chatTextAreaRef.current;
		if (!inputEl) return;

		const scrollChatIntoView = () => {
			// Mobile-first: ensure input stays above virtual keyboard.
			const isMobile = window.matchMedia('(max-width: 900px)').matches;
			if (!isMobile) return;
			window.setTimeout(() => {
				inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
			}, 120);
		};

		inputEl.addEventListener('focus', scrollChatIntoView);
		return () => inputEl.removeEventListener('focus', scrollChatIntoView);
	}, [isChatOpen]);

	useEffect(() => {
		// Prevent background scroll when chat is open on mobile.
		if (!(isMobileViewport && isChatOpen)) return;
		const prev = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = prev;
		};
	}, [isMobileViewport, isChatOpen]);

	useEffect(() => {
		// Close chat while navigating across pages on mobile.
		if (isMobileViewport) setIsChatOpen(false);
	}, [view, isMobileViewport]);

	const applyQuickPrompt = (prompt: string) => {
		setChatInput(prompt);
		setIsChatOpen(true);
		setHasUnreadChat(false);
	};

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
				navPricing: 'Абонаменти',
				navClients: 'Клиенти',
				navWatchlist: 'Списък',
				navLogin: 'Вход',
				navGetStarted: 'Започни',
				langAria: 'Превключи език',
				heroSub:
					'Специализиран AI слой за агротърговия с реални данни и цени за Европа и MENA — жива поддръжка с OpenAI на бекенда.',
				createAccount: 'Създай акаунт',
				livePreview: 'Преглед на жив пазар',
				activeOpps: 'Активни възможности',
				liveDealsHint: '4 от 240+ живи сделки — Египет като основен вносител',
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
				unlock: 'Отключи',
				coverageTitle: 'Капацитет и покритие',
				coverageBody:
					'Поддържаме мулти-държавно търсене и предлагане в EU + MENA. AI чатът получава топ филтрираните сделки като контекст.',
				watchlistTitle: 'Моят списък',
				watchlistEmpty: 'Няма запазени сделки. Отвори Пазара и натисни „Запази“.',
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
				marketPulse: 'Пазарен импулс',
				chatThinking: 'Мисля…',
				chatTitle: 'AgriNexus AI',
				chatSubtitle:
					'Жив чат през OpenAI (gpt-4o-mini по подразбиране). Контекст: до 18 от филтрираните сделки в Пазара.',
				chatPromptsLabel: 'Бързи подкани',
				chatClear: 'Изчисти',
				chatPlaceholder: 'Попитайте за маршрут, марж, сертификати…',
				chatToggleOn: 'Затвори чата',
				chatToggleOff: 'Отвори чата',
				mobileChat: 'Чат',
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
				pricingWeekly: 'Седмичен',
				pricingMonthly: 'Месечен',
				pricingYearly: 'Годишен',
				pricingWeek: 'седмица',
				pricingMonth: 'месец',
				pricingYear: 'година',
				pricingBestValue: 'НАЙ-ИЗГОДЕН',
				pricingSubscribe: 'Абонирай се',
				pricingPer: 'на',
				pricingYearlyNote: '+1 месец безплатно',
				pricingConceptTitle: 'Каква е концепцията',
				pricingConceptBody:
					'Абонаментът дава работещ AI инструмент за търговски решения, а не просто достъп до данни. Фокусът е по-бърз избор на сделки, по-нисък риск и по-добър контрол върху маржа.',
				pricingBenefit1: 'BUY/HOLD/AVOID логика върху текущия пазарен филтър',
				pricingBenefit2: 'Клиентски контекст, сертификати и маршрутни рискове на едно място',
				pricingBenefit3: 'Известия и по-бърз оперативен цикъл за екипа',
				pricingContactLead: 'Продажби:',
				pricingContactText: 'всички абонаментни запитвания и оферти се координират от този адрес.',
				pricingFaqTitle: 'Често задавани въпроси',
				pricingFaqQ1: 'Има ли минимален срок на договора?',
				pricingFaqA1: 'Не. Можете да променяте или ъпгрейдвате плана според нуждите си.',
				pricingFaqQ2: 'Как се отчитат AI заявките?',
				pricingFaqA2: 'Лимитът е месечен и се обновява автоматично в началото на периода.',
				pricingFaqQ3: 'Имате ли onboarding за фирми?',
				pricingFaqA3: 'Да. За Pro и Business има onboarding, съобразен с вашия търговски процес.',
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
					'Специализиран AI слой за оптимизация на агротърговията. Интеграция на реални пазарни данни, прогнозни цени, buyer-seller matching и търговски известия.',
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
			navPricing: 'Pricing',
			navClients: 'Clients',
			navWatchlist: 'Watchlist',
			navLogin: 'Sign In',
			navGetStarted: 'Get Started',
			langAria: 'Switch language',
			heroSub:
				'Domain-specific AI layer on top of a powerful model for agricultural trading. Real data, real prices, real markets, and decision logic for Europe and MENA — powered by OpenAI on the backend for live chat.',
			createAccount: 'Create your account',
			livePreview: 'Live Market Preview',
			activeOpps: 'Active Trade Opportunities',
			liveDealsHint: '4 of 240+ live deals — Egypt included as a major importer',
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
			unlock: 'Unlock',
			coverageTitle: 'Coverage capacity',
			coverageBody:
				'Current setup supports multi-country supply and demand across EU + MENA. The AI chat receives the top filtered deals as context — refine search before asking for BUY/HOLD/AVOID reasoning.',
			watchlistTitle: 'Watchlist',
			watchlistEmpty: 'No saved deals yet. Open Marketplace and tap Watch.',
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
			marketPulse: 'Market pulse',
			chatThinking: 'Thinking…',
			chatTitle: 'AgriNexus AI',
			chatSubtitle:
				'Live chat via OpenAI (gpt-4o-mini by default). Context: up to 18 deals from your current Marketplace filter.',
			chatPromptsLabel: 'Quick prompts',
			chatClear: 'Clear',
			chatPlaceholder: 'Ask about routes, margin, certifications…',
			chatToggleOn: 'Close chat',
			chatToggleOff: 'Open chat',
			mobileChat: 'Chat',
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
			pricingWeekly: 'Weekly',
			pricingMonthly: 'Monthly',
			pricingYearly: 'Yearly',
			pricingWeek: 'week',
			pricingMonth: 'month',
			pricingYear: 'year',
			pricingBestValue: 'BEST VALUE',
			pricingSubscribe: 'Subscribe',
			pricingPer: 'per',
			pricingYearlyNote: '+1 month free',
			pricingConceptTitle: 'What is the concept',
			pricingConceptBody:
				'The subscription is a practical AI trade cockpit, not only raw data access. It helps teams decide faster, reduce risk exposure, and protect margin consistency.',
			pricingBenefit1: 'BUY/HOLD/AVOID logic based on your live marketplace filter',
			pricingBenefit2: 'Client context, certifications and route risk in one workflow',
			pricingBenefit3: 'Alerts and faster execution cycle for the trade team',
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
				'Domain-specific AI layer for agricultural trade optimization. Real market data integration, predictive pricing, buyer-seller matching, and trade alerts.',
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

	const landingAiCards = useMemo(() => {
		const bgCopy = [
			{
				title: 'КУПИ / ЗАДРЪЖ / ИЗБЕГНИ',
				text: 'AI търговска логика от реални сигнали и исторически сделки.',
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

	const quickPrompts = lang === 'bg' ? QUICK_PROMPTS_BG : QUICK_PROMPTS_EN;
	const marketFlashLines = lang === 'bg' ? MARKET_FLASH_BG : MARKET_FLASH_EN;
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

	const getConfidenceMeta = (text: string): { label: string; tone: 'low' | 'medium' | 'high' } | null => {
		const match = text.match(/(?:Confidence|Ниво на увереност):\s*(LOW|MEDIUM|HIGH)/i);
		if (!match) return null;
		const raw = match[1].toUpperCase();
		if (raw === 'LOW') return { label: 'LOW', tone: 'low' };
		if (raw === 'MEDIUM') return { label: 'MEDIUM', tone: 'medium' };
		return { label: 'HIGH', tone: 'high' };
	};

	return (
		<div className="app">
			<style>{`
        :root {
          --bg: #0b1221;
          --panel: #161f32;
          --panel-2: #0f172a;
          --border: #1e293b;
          --text-muted: #94a3b8;
          --green: #22c55e;
        }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: Inter, Segoe UI, Arial, sans-serif; background: var(--bg); color: white; }
        .app { min-height: 100vh; background: var(--bg); color: #fff; }

        @keyframes scrollDeals {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        .nav {
          display: flex; justify-content: space-between; align-items: center; gap: 12px;
          padding: 14px 18px; background: var(--panel-2); border-bottom: 1px solid var(--border);
          position: sticky; top: 0; z-index: 100; flex-wrap: wrap;
        }
        .brand { display: flex; align-items: center; gap: 10px; font-weight: 900; cursor: pointer; }
        .nav-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .nav-link {
          color: #fff; opacity: 0.92; padding: 8px 10px; border-radius: 8px; cursor: pointer;
          border: 1px solid transparent;
        }
        .nav-link.active { color: var(--green); background: rgba(34, 197, 94, 0.08); }

        .btn {
          border: none; border-radius: 12px; cursor: pointer; font-weight: 700;
          display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 11px 16px;
        }
        .btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .btn-primary { background: var(--green); color: white; }
        .btn-light { background: white; color: #0f172a; }
        .btn-outline { background: transparent; color: var(--green); border: 1px solid var(--green); }

        .section { max-width: 1220px; margin: 0 auto; padding: 24px 14px 36px; }
        .hero { text-align: center; padding-top: 42px; }
        .hero h1 { font-size: clamp(2.1rem, 8vw, 4.6rem); margin: 0 0 12px; }
        .hero p { color: var(--text-muted); max-width: 860px; margin: 0 auto 20px; }

        .ai-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-top: 22px; }
        .ai-card { background: var(--panel); border: 1px solid var(--border); border-radius: 14px; padding: 14px; text-align: left; }
        .ai-card h4 { margin: 10px 0 6px; }
        .ai-card p { margin: 0; color: var(--text-muted); font-size: .9rem; }

        .preview-mask {
          overflow: hidden;
          mask-image: linear-gradient(to right, transparent, black 40px, black calc(100% - 40px), transparent);
          -webkit-mask-image: linear-gradient(to right, transparent, black 40px, black calc(100% - 40px), transparent);
        }
        .deals-track { display: flex; gap: 16px; width: max-content; animation: scrollDeals 24s linear infinite; }
        .deals-track:hover { animation-play-state: paused; }

        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
        .deal-card, .pricing-card {
          background: var(--panel); border: 1px solid var(--border); border-radius: 16px; padding: 14px; position: relative;
        }
        .deal-card.top { border: 2px solid var(--green); }

        .pricing-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px; }
        .pricing-card { text-align: center; padding: 14px; }
        .pricing-card.popular { border: 2px solid var(--green); }
        .badge {
          position: absolute; top: -12px; left: 50%; transform: translateX(-50%);
          background: var(--green); padding: 5px 10px; border-radius: 999px; font-size: .73rem; font-weight: 800;
        }
        .pricing-value { font-size: 1.7rem; font-weight: 900; margin: 8px 0; }

        .market-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 18px; }
        .ticker-wrap { margin-bottom: 12px; border: 1px solid #1f2937; border-radius: 10px; background: #0b1221; overflow: hidden; }
        .ticker-track { display: flex; gap: 20px; width: max-content; padding: 10px 0; animation: scrollDeals 35s linear infinite; }
        .ticker-track:hover { animation-play-state: paused; }
        .ticker-item { white-space: nowrap; font-size: .86rem; color: #d1fae5; }
        .ticker-item strong { color: #22c55e; margin-left: 8px; }
        .market-flash-line {
          margin: 0; flex: 1; min-width: 180px;
          background: rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 10px;
          padding: 11px 13px; color: #bbf7d0; font-size: .9rem;
        }
        .terminal-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin: 10px 0 14px; }
        .terminal-metric { background: #0b1221; border: 1px solid #1f2937; border-radius: 8px; padding: 8px 10px; }
        .terminal-metric strong { color: #86efac; display: block; font-size: 1.05rem; }
        .terminal-metric span { color: #94a3b8; font-size: .76rem; }
        .deal-actions { margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap; }
        .deal-chip-btn {
          border: 1px solid #334155; background: #0f172a; color: #cbd5e1; border-radius: 999px;
          padding: 5px 10px; font-size: .74rem; cursor: pointer;
        }
        .deal-chip-btn.active { border-color: #22c55e; color: #86efac; }
        .live-dot {
          width: 8px; height: 8px; background: #22c55e; border-radius: 999px; display: inline-block; margin-right: 6px;
          animation: pulseDot 1.6s infinite;
        }
        @keyframes pulseDot {
          0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, .6); }
          100% { box-shadow: 0 0 0 10px rgba(34, 197, 94, 0); }
        }
        .pulse-toolbar {
          display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px;
        }
        .search-wrap { position: relative; width: min(100%, 480px); flex: 1; }
        .search-wrap input {
          width: 100%; padding: 12px 12px 12px 42px; border-radius: 12px; outline: none;
          background: #1e293b; color: #fff; border: 1px solid #334155;
        }
        .search-icon { position: absolute; left: 13px; top: 11px; color: #64748b; }

        .locked-overlay {
          position: absolute; inset: 0; border-radius: 16px;
          background: rgba(11, 18, 33, 0.56); display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 8px;
        }

        .muted { color: var(--text-muted); }
        .green-note { color: var(--green); font-weight: 700; }
        .contact-panel {
          background: var(--panel); border: 1px solid var(--border); border-radius: 14px; padding: 14px; margin-top: 16px;
        }

        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .form-grid input, .form-grid select, .form-grid textarea {
          width: 100%; padding: 11px; border-radius: 10px; border: 1px solid #334155; background: #1e293b; color: #fff;
          font-family: inherit;
        }

        .chat-box { position: fixed; right: 12px; bottom: 12px; z-index: 200; }
        .chat-window {
          width: min(92vw, 380px); background: #1e293b; border: 1px solid #334155;
          border-radius: 14px; padding: 12px; margin-bottom: 8px;
          display: flex; flex-direction: column; max-height: min(70vh, 520px);
        }
        .chat-messages {
          flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 10px;
          margin-bottom: 10px; padding-right: 4px;
        }
        .chat-bubble {
          align-self: flex-start; max-width: 100%; padding: 10px 12px; border-radius: 12px;
          font-size: .9rem; line-height: 1.45;
        }
        .chat-bubble.user {
          align-self: flex-end; background: rgba(34, 197, 94, 0.15); border: 1px solid rgba(34, 197, 94, 0.35);
        }
        .chat-bubble.assistant {
          background: #0f172a; border: 1px solid #334155;
        }
        .confidence-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          font-size: .68rem;
          font-weight: 800;
          padding: 3px 8px;
          margin-bottom: 7px;
          letter-spacing: .02em;
        }
        .confidence-badge.high {
          background: rgba(34, 197, 94, 0.16);
          border: 1px solid rgba(34, 197, 94, 0.42);
          color: #86efac;
        }
        .confidence-badge.medium {
          background: rgba(245, 158, 11, 0.16);
          border: 1px solid rgba(245, 158, 11, 0.45);
          color: #fcd34d;
        }
        .confidence-badge.low {
          background: rgba(239, 68, 68, 0.16);
          border: 1px solid rgba(239, 68, 68, 0.45);
          color: #fca5a5;
        }
        .chat-input-row { display: flex; gap: 8px; align-items: flex-end; }
        .chat-input-row textarea {
          flex: 1; resize: none; min-height: 44px; max-height: 120px; padding: 10px;
          border-radius: 10px; border: 1px solid #334155; background: #0b1221; color: #fff; font-family: inherit;
        }
        .chat-prompt-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
        .chat-prompt-chip {
          border: 1px solid #334155; background: #0f172a; color: #cbd5e1; border-radius: 999px;
          padding: 6px 10px; font-size: .76rem; cursor: pointer;
        }
        .chat-actions { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 8px; }
        .btn-mini {
          background: transparent; color: #94a3b8; border: 1px solid #334155; border-radius: 8px;
          padding: 5px 9px; cursor: pointer; font-size: .76rem;
        }

        .clients-layout { display: grid; grid-template-columns: 340px 1fr; gap: 14px; }
        .client-list { background: var(--panel); border: 1px solid var(--border); border-radius: 14px; padding: 10px; }
        .client-list-item {
          width: 100%; text-align: left; border: 1px solid transparent; background: #0f172a; color: #fff;
          padding: 10px; border-radius: 10px; margin-bottom: 8px; cursor: pointer;
        }
        .client-list-item.active { border-color: #22c55e; background: rgba(34, 197, 94, 0.08); }
        .client-card { background: var(--panel); border: 1px solid var(--border); border-radius: 14px; padding: 16px; }
        .client-meta-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 12px; }
        .meta-kv { background: #0f172a; border: 1px solid #1f2937; border-radius: 10px; padding: 10px; }
        .status-pill {
          display: inline-flex; padding: 4px 8px; border-radius: 999px; font-size: .74rem; font-weight: 700;
          background: rgba(34, 197, 94, 0.13); color: #4ade80;
        }
        .chat-trigger {
          width: 54px; height: 54px; border-radius: 999px; border: none; background: var(--green);
          display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
        }
        .chat-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(2, 6, 23, 0.5);
          z-index: 190;
        }
        .mobile-nav { display: none; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.85s linear infinite; display: inline-block; }

        @media (max-width: 700px) {
          .form-grid { grid-template-columns: 1fr; }
          .grid, .pricing-grid { grid-template-columns: 1fr; }
          .clients-layout, .client-meta-grid { grid-template-columns: 1fr; }
          .terminal-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }

        @media (max-width: 900px) {
          .section { padding: 16px 10px 110px; }
          .nav { padding: 10px 12px; }
          .nav-actions { gap: 6px; }
          .nav-link { padding: 7px 8px; font-size: .86rem; }
          .nav-link-mobile-hide { display: none !important; }
          .btn { padding: 10px 12px; border-radius: 10px; }
          .deal-card, .pricing-card, .ai-card, .contact-panel, .client-card { padding: 12px; border-radius: 12px; }
          .deal-card h3, .pricing-card h3 { font-size: 1rem; }
          .muted { font-size: .9rem; }

          .pricing-grid {
            display: flex;
            overflow-x: auto;
            gap: 12px;
            scroll-snap-type: x mandatory;
            padding-bottom: 6px;
          }
          .pricing-grid::-webkit-scrollbar { height: 6px; }
          .pricing-grid::-webkit-scrollbar-thumb { background: #334155; border-radius: 999px; }
          .pricing-grid .pricing-card {
            min-width: 228px;
            flex: 0 0 auto;
            scroll-snap-align: center;
          }

          .mobile-nav {
            position: fixed;
            left: 10px;
            right: 10px;
            bottom: 10px;
            z-index: 160;
            background: rgba(15, 23, 42, 0.98);
            border: 1px solid #334155;
            border-radius: 14px;
            padding: 8px;
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 6px;
            backdrop-filter: blur(6px);
          }
          .mobile-nav-btn {
            border: 1px solid transparent;
            background: #0b1221;
            color: #cbd5e1;
            border-radius: 10px;
          padding: 8px 8px;
            font-size: .78rem;
            font-weight: 700;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 4px;
          transition: transform .08s ease, background .2s ease, border-color .2s ease, color .2s ease;
        }
        .mobile-nav-btn:active {
          transform: scale(0.97);
        }
        .mobile-nav-btn svg {
          width: 16px;
          height: 16px;
          }
          .mobile-nav-btn.active {
            border-color: rgba(34, 197, 94, 0.45);
            color: #86efac;
            background: rgba(34, 197, 94, 0.08);
          }
          .unread-dot {
            width: 8px;
            height: 8px;
            border-radius: 999px;
            background: #22c55e;
            box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.18);
            display: inline-block;
          }
        }
      `}</style>

			<nav className="nav">
				<div className="brand" onClick={() => setView('landing')}>
					<Leaf color="#22c55e" size={24} />
					<span>AgriNexus</span>
				</div>
				<div className="nav-actions">
					<span
						className={`nav-link nav-link-mobile-hide ${view === 'landing' ? 'active' : ''}`}
						onClick={() => setView('landing')}>
						{tr.navHome}
					</span>
					<span
						className={`nav-link nav-link-mobile-hide ${view === 'market' ? 'active' : ''}`}
						onClick={() => setView('market')}>
						{tr.navMarket}
					</span>
					<span
						className={`nav-link nav-link-mobile-hide ${view === 'pricing' ? 'active' : ''}`}
						onClick={() => setView('pricing')}>
						{tr.navPricing}
					</span>
					<span
						className={`nav-link nav-link-mobile-hide ${view === 'clients' ? 'active' : ''}`}
						onClick={() => setView('clients')}>
						{tr.navClients}
					</span>
					<span
						className={`nav-link nav-link-mobile-hide ${view === 'watchlist' ? 'active' : ''}`}
						onClick={() => setView('watchlist')}>
						{tr.navWatchlist}
					</span>
					<span
						className={`nav-link nav-link-mobile-hide ${view === 'login' ? 'active' : ''}`}
						onClick={() => setView('login')}>
						<LogIn size={14} /> {tr.navLogin}
					</span>
					<button
						type="button"
						className="btn-mini"
						aria-label={tr.langAria}
						onClick={() => setLang(x => (x === 'bg' ? 'en' : 'bg'))}>
						<Globe2 size={14} /> {lang === 'bg' ? 'EN' : 'BG'}
					</button>
					<button className="btn btn-primary" onClick={() => setView('register')}>
						<UserPlus size={14} /> {tr.navGetStarted}
					</button>
				</div>
			</nav>

			{view === 'landing' && (
				<section className="section hero">
					<h1>AgriNexus</h1>
					<p>{tr.heroSub}</p>
					<button className="btn btn-primary" onClick={() => setView('register')}>
						{tr.createAccount}
					</button>

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

					<div style={{ marginTop: 24 }}>
						<p
							style={{
								color: '#22c55e',
								letterSpacing: 2,
								fontSize: '.75rem',
								fontWeight: 700,
								textTransform: 'uppercase',
								marginBottom: 6,
							}}>
							{tr.livePreview}
						</p>
						<h2 style={{ margin: '6px 0' }}>{tr.activeOpps}</h2>
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
									style={{ width: 260, flexShrink: 0 }}>
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
									{deal.locked && (
										<div className="locked-overlay">
											<Lock color="#22c55e" size={24} />
											<span
												style={{
													color: '#22c55e',
													fontSize: '.8rem',
													fontWeight: 700,
												}}>
												{tr.premiumAccess}
											</span>
										</div>
									)}
								</div>
							))}
						</div>
					</div>

					<div style={{ marginTop: 16 }}>
						<button className="btn btn-outline" onClick={() => setView('market')}>
							{tr.openMarketplace}
						</button>
						<button
							className="btn btn-outline"
							style={{ marginLeft: 8 }}
							onClick={() => setView('clients')}>
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
							const isLocked = !isPremium && i >= 5;
							const delta = deal.profit - deal.prevProfit;
							return (
								<div className={`deal-card ${i < 5 ? 'top' : ''}`} key={deal.id}>
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
											<Lock color="#22c55e" size={24} />
											<button
												className="btn btn-primary"
												onClick={() => setView('pricing')}>
												{tr.unlock}
											</button>
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
							<p className="muted">{tr.watchlistEmpty}</p>
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
					<div className="pricing-grid">
						<PricingCard
							title={tr.pricingWeekly}
							price="25"
							period={tr.pricingWeek}
							lang={lang}
							labels={{
								bestValue: tr.pricingBestValue,
								subscribe: tr.pricingSubscribe,
								per: tr.pricingPer,
							}}
						/>
						<PricingCard
							title={tr.pricingMonthly}
							price="49"
							period={tr.pricingMonth}
							popular
							lang={lang}
							labels={{
								bestValue: tr.pricingBestValue,
								subscribe: tr.pricingSubscribe,
								per: tr.pricingPer,
							}}
						/>
						<PricingCard
							title={tr.pricingYearly}
							price="365"
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
					<div className="contact-panel">
						<h3 style={{ marginTop: 0 }}>{tr.pricingConceptTitle}</h3>
						<p className="muted" style={{ marginTop: 6 }}>
							{tr.pricingConceptBody}
						</p>
						<div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
							<p className="muted" style={{ margin: 0 }}>
								• {tr.pricingBenefit1}
							</p>
							<p className="muted" style={{ margin: 0 }}>
								• {tr.pricingBenefit2}
							</p>
							<p className="muted" style={{ margin: 0 }}>
								• {tr.pricingBenefit3}
							</p>
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

			{isMobileViewport && (
				<div className="mobile-nav">
					<button
						type="button"
						className={`mobile-nav-btn ${view === 'landing' ? 'active' : ''}`}
						onClick={() => setView('landing')}>
						<Leaf size={16} />
						{tr.navHome}
					</button>
					<button
						type="button"
						className={`mobile-nav-btn ${view === 'market' ? 'active' : ''}`}
						onClick={() => setView('market')}>
						<Search size={16} />
						{tr.navMarket}
					</button>
					<button
						type="button"
						className={`mobile-nav-btn ${view === 'pricing' ? 'active' : ''}`}
						onClick={() => setView('pricing')}>
						<CreditCard size={16} />
						{tr.navPricing}
					</button>
					<button
						type="button"
						className={`mobile-nav-btn ${isChatOpen ? 'active' : ''}`}
						onClick={() =>
							setIsChatOpen(v => {
								const next = !v;
								if (next) setHasUnreadChat(false);
								return next;
							})
						}>
						<MessageSquare size={16} />
						{tr.mobileChat}
						{hasUnreadChat && !isChatOpen && <span className="unread-dot" />}
					</button>
				</div>
			)}

			<div
				className="chat-box"
				style={{
					bottom: chatKeyboardOffset + (isMobileViewport ? 70 : 0),
					left: isMobileViewport && isChatOpen ? 10 : undefined,
					right: isMobileViewport && isChatOpen ? 10 : 12,
				}}>
				{isMobileViewport && isChatOpen && (
					<div className="chat-backdrop" onClick={() => setIsChatOpen(false)} />
				)}
				{isChatOpen && (
					<div
						className="chat-window"
						style={
							isMobileViewport
								? { width: '100%', maxHeight: Math.max(280, chatViewportHeight - 140) }
								: undefined
						}>
						<div style={{ fontWeight: 700, color: '#22c55e', marginBottom: 6 }}>
							{tr.chatTitle}
						</div>
						<p className="muted" style={{ margin: '0 0 8px', fontSize: '.82rem' }}>
							{tr.chatSubtitle}
						</p>
						<div className="chat-actions">
							<span className="muted" style={{ fontSize: '.75rem' }}>
								{tr.chatPromptsLabel}
							</span>
							<button
								className="btn-mini"
								type="button"
								onClick={() => setChatMessages([])}>
								{tr.chatClear}
							</button>
						</div>
						<div className="chat-prompt-row">
							{quickPrompts.map(prompt => (
								<button
									key={prompt}
									className="chat-prompt-chip"
									type="button"
									onClick={() => applyQuickPrompt(prompt)}>
									{prompt}
								</button>
							))}
						</div>
						<div className="chat-messages">
							{chatMessages.map((m, idx) => {
								const confidenceMeta =
									m.role === 'assistant' ? getConfidenceMeta(m.content) : null;
								const renderedContent =
									m.role === 'assistant'
										? m.content
												.replace(
													/(?:^|\n)(?:Confidence|Ниво на увереност):\s*(LOW|MEDIUM|HIGH)\s*(?:\n|$)/i,
													'\n'
												)
												.replace(/\n{3,}/g, '\n\n')
												.trim()
										: m.content;
								return (
									<div key={`${idx}-${m.role}`} className={`chat-bubble ${m.role}`}>
										{confidenceMeta && (
											<div className={`confidence-badge ${confidenceMeta.tone}`}>
												Confidence: {confidenceMeta.label}
											</div>
										)}
										{renderedContent}
									</div>
								);
							})}
							{chatLoading && (
								<div
									className="chat-bubble assistant"
									style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
									<Loader2 size={16} className="spin" /> {tr.chatThinking}
								</div>
							)}
							<div ref={chatEndRef} />
						</div>
						<div className="chat-input-row">
							<textarea
								ref={chatTextAreaRef}
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
								className="btn btn-primary"
								type="button"
								disabled={chatLoading}
								onClick={() => void sendChat()}>
								<Send size={18} />
							</button>
						</div>
					</div>
				)}
				{!isMobileViewport && (
					<button
						className="chat-trigger"
						onClick={() =>
							setIsChatOpen(v => {
								const next = !v;
								if (next) setHasUnreadChat(false);
								return next;
							})
						}
						aria-label={isChatOpen ? tr.chatToggleOn : tr.chatToggleOff}>
						{isChatOpen ? <X color="white" /> : <MessageSquare color="white" />}
					</button>
				)}
			</div>
		</div>
	);
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	ArrowLeft,
	BarChart3,
	Bookmark,
	Building2,
	CalendarDays,
	Calculator,
	ChevronDown,
	ChevronUp,
	ClipboardList,
	FileImage,
	FileText,
	FileUp,
	Globe2,
	Leaf,
	LineChart,
	Loader2,
	LogIn,
	Mail,
	MessageSquare,
	Mic,
	RefreshCw,
	Search,
	Send,
	Shield,
	UserPlus,
	Users,
	X,
} from 'lucide-react';
import FileUploadPanel from './FileUploadPanel';
import { SubsidyCalculatorView } from './components/SubsidyCalculatorView';
import { SeasonCalendarView } from './components/SeasonCalendarView';
import { FarmerCommandCenter } from './components/FarmerCommandCenter';
import { CloudAuthPanel } from './components/CloudAuthPanel';
import { TradeDocumentsBulgariaView } from './components/TradeDocumentsBulgariaView';
import { CropStatisticsBulgariaView } from './components/CropStatisticsBulgariaView';
import { FoodSecurityBreakEvenView } from './components/FoodSecurityBreakEvenView';
import { OperationsHubView } from './components/OperationsHubView';
import { MarketWatchView } from './components/MarketWatchView';
import {
	cycleUiLang,
	getUiStrings,
	localeTagFor,
	parseStoredLang,
	speechRecognitionLang,
	uiLangShortLabel,
	type UiLang,
} from './lib/i18n';
import { PRODUCT_INSTRUMENT } from './lib/market-instruments';
import { recordBrowserVisitOncePerSession } from './lib/track-browser-visit';
import type { ChatPersona } from './lib/chat-persona';
import {
	ASSISTANT_QUICK_PROMPTS,
	type AssistantQuickPromptItem,
	quickPromptLabel,
} from './lib/assistant-quick-actions';
import { buildFarmerContextForAi } from './lib/build-farmer-context-for-ai';
import { scoreDealSearchMatch } from './lib/market-search';
import type { FarmProductionFocus } from './lib/subsidy-calculator';
import { getSupabaseBrowserClient } from './lib/infra/supabase-browser';
import { useSupabaseSession } from './hooks/use-supabase-session';

function uiPickTwo(lang: UiLang, bg: string, en: string): string {
	return lang === 'bg' ? bg : en;
}

/** When `VITE_MVP_MODE=1` in `.env`, hides clients/watchlist — core funnel only. Omit or leave unset for full navigation. */
const MVP_MODE = import.meta.env.VITE_MVP_MODE === '1';

/** За подсказка при офлайн `/api/chat` — същият порт като `DEV_API_PORT` в `.env` (vite proxy). */
const DEV_API_PORT_HINT =
	String(import.meta.env.VITE_DEV_API_PORT ?? '').trim() || '8788';
const COOKIE_CONSENT_KEY = 'agrinexus-cookie-consent';
type CookieConsent = 'accepted' | 'rejected';

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

type MarketQuotesApi =
	| { ok: true; mode: 'demo'; quotes: []; fetchedAt: string; source: null }
	| {
			ok: true;
			mode: 'live';
			quotes: Array<{ symbol: string; open: number; close: number; date: string; time: string }>;
			fetchedAt: string;
			source: 'stooq_delayed';
	  }
	| { ok: false; mode: 'error'; quotes: []; fetchedAt: string; source: null; error: string };

/** Avoid uncaught exceptions when storage is blocked (private mode, enterprise policy) — those crash the whole app with a blank screen. */
function safeLocalGet(key: string): string | null {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

function safeLocalSet(key: string, value: string): void {
	try {
		localStorage.setItem(key, value);
	} catch {
		/* ignore */
	}
}

function safeLocalRemove(key: string): void {
	try {
		localStorage.removeItem(key);
	} catch {
		/* ignore */
	}
}

function safeSessionGet(key: string): string | null {
	try {
		return sessionStorage.getItem(key);
	} catch {
		return null;
	}
}

function safeSessionSet(key: string, value: string): void {
	try {
		sessionStorage.setItem(key, value);
	} catch {
		/* ignore */
	}
}

function safeSessionRemove(key: string): void {
	try {
		sessionStorage.removeItem(key);
	} catch {
		/* ignore */
	}
}

type ChatTurn = { role: 'user' | 'assistant'; content: string };

type SendChatOpts = { text?: string; persona?: ChatPersona };
type OblastCity = { id: string; bg: string; en: string };

const FIELD_WATCH_OBLAST_CITIES: OblastCity[] = [
	{ id: 'blagoevgrad', bg: 'Благоевград', en: 'Blagoevgrad' },
	{ id: 'burgas', bg: 'Бургас', en: 'Burgas' },
	{ id: 'varna', bg: 'Варна', en: 'Varna' },
	{ id: 'veliko-tarnovo', bg: 'Велико Търново', en: 'Veliko Tarnovo' },
	{ id: 'vidin', bg: 'Видин', en: 'Vidin' },
	{ id: 'vratsa', bg: 'Враца', en: 'Vratsa' },
	{ id: 'gabrovo', bg: 'Габрово', en: 'Gabrovo' },
	{ id: 'dobrich', bg: 'Добрич', en: 'Dobrich' },
	{ id: 'kardzhali', bg: 'Кърджали', en: 'Kardzhali' },
	{ id: 'kyustendil', bg: 'Кюстендил', en: 'Kyustendil' },
	{ id: 'lovech', bg: 'Ловеч', en: 'Lovech' },
	{ id: 'montana', bg: 'Монтана', en: 'Montana' },
	{ id: 'pazardzhik', bg: 'Пазарджик', en: 'Pazardzhik' },
	{ id: 'pernik', bg: 'Перник', en: 'Pernik' },
	{ id: 'pleven', bg: 'Плевен', en: 'Pleven' },
	{ id: 'plovdiv', bg: 'Пловдив', en: 'Plovdiv' },
	{ id: 'razgrad', bg: 'Разград', en: 'Razgrad' },
	{ id: 'ruse', bg: 'Русе', en: 'Ruse' },
	{ id: 'silistra', bg: 'Силистра', en: 'Silistra' },
	{ id: 'sliven', bg: 'Сливен', en: 'Sliven' },
	{ id: 'smolyan', bg: 'Смолян', en: 'Smolyan' },
	{ id: 'sofia', bg: 'София', en: 'Sofia' },
	{ id: 'sofia-oblast', bg: 'София област', en: 'Sofia Oblast' },
	{ id: 'stara-zagora', bg: 'Стара Загора', en: 'Stara Zagora' },
	{ id: 'targovishte', bg: 'Търговище', en: 'Targovishte' },
	{ id: 'haskovo', bg: 'Хасково', en: 'Haskovo' },
	{ id: 'shumen', bg: 'Шумен', en: 'Shumen' },
	{ id: 'yambol', bg: 'Ямбол', en: 'Yambol' },
];

/** Minimal typings — DOM lib does not always expose Web Speech API types. */
type SpeechRecognitionResultEvt = {
	results: ArrayLike<{ 0: { transcript: string } }>;
};

type SpeechRecognitionInstance = {
	lang: string;
	continuous: boolean;
	interimResults: boolean;
	start(): void;
	stop(): void;
	onresult: ((ev: SpeechRecognitionResultEvt) => void) | null;
	onerror: (() => void) | null;
	onend: (() => void) | null;
};

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionInstance) | null {
	if (typeof window === 'undefined') return null;
	const w = window as Window &
		typeof globalThis & {
			SpeechRecognition?: new () => SpeechRecognitionInstance;
			webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
		};
	return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
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
	/** Present when marketplace merges delayed futures references. */
	priceSource?: 'synthetic' | 'futures_delayed';
	referenceSymbol?: string;
};
type DealCategoryFilter = 'all' | DealRow['category'];
type SearchableDeal = DealRow & { searchText: string };
type Lang = UiLang;

function mergeLiveIntoDeals(
	deals: DealRow[],
	quotes: Array<{ symbol: string; open: number; close: number }>,
	lang: Lang,
): DealRow[] {
	const bySym = new Map(quotes.map(q => [q.symbol.toLowerCase(), q]));
	return deals.map(deal => {
		const inst = PRODUCT_INSTRUMENT[deal.product];
		if (!inst) {
			return { ...deal, priceSource: 'synthetic' as const, referenceSymbol: undefined };
		}
		const q = bySym.get(inst.symbol.toLowerCase());
		if (!q) {
			return { ...deal, priceSource: 'synthetic' as const, referenceSymbol: undefined };
		}
		const unit = lang === 'bg' ? inst.unitBg : inst.unitEn;
		const pct = q.open !== 0 ? ((q.close - q.open) / q.open) * 100 : 0;
		const profit = Math.min(34, Math.max(6, Math.round(16 + pct * 1.8)));
		const prevProfit = Math.min(34, Math.max(6, Math.round(16 + (pct - 0.35) * 1.8)));
		const volatility: DealRow['volatility'] =
			Math.abs(pct) >= 2 ? 'HIGH' : Math.abs(pct) >= 0.85 ? 'MED' : 'LOW';
		const decimals = inst.symbol === 'zr.f' ? 3 : 2;
		const price = `${q.close.toFixed(decimals)} ${unit}`;
		const prevPrice = `${q.open.toFixed(decimals)} ${unit}`;
		return {
			...deal,
			price,
			prevPrice,
			profit,
			prevProfit,
			margin: Math.max(5, profit - 4),
			volatility,
			decision: getDecisionBySignals({ profit, volatility, category: deal.category }),
			priceSource: 'futures_delayed' as const,
			referenceSymbol: inst.symbol,
		};
	});
}

type View =
	| 'landing'
	| 'market'
	| 'market-watch'
	| 'assistant'
	| 'register'
	| 'login'
	| 'company'
	| 'clients'
	| 'watchlist'
	| 'privacy'
	| 'terms'
	| 'subsidy-calculator'
	| 'season-calendar'
	| 'trade-documents'
	| 'crop-statistics'
	| 'food-security'
	| 'command'
	| 'file-upload'
	| 'field-watch';

const TRADING_VIEWS = new Set<View>(['market', 'market-watch', 'crop-statistics', 'trade-documents']);
const FARM_VIEWS = new Set<View>(['command', 'subsidy-calculator', 'season-calendar', 'field-watch']);
const LOGISTICS_VIEWS = new Set<View>(['food-security', 'file-upload']);

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

const PRODUCT_BG_ALIASES: Record<string, string[]> = {
	'Wheat (Premium)': ['пшеница', 'премиум пшеница', 'зърно', 'wheat', 'durum', 'твърда пшеница'],
	Corn: ['царевица', 'зърно', 'maize', 'corn'],
	Barley: ['ечемик', 'зърно', 'barley'],
	'Sunflower Seed': ['слънчогледово семе', 'слънчоглед', 'sunflower', 'seeds'],
	Rapeseed: ['рапица', 'canola', 'rapeseed'],
	Chickpeas: ['нахут', 'chickpea', 'garbanzo'],
	Lentils: ['леща', 'lentil'],
	'Tomato Paste': ['доматено пюре', 'paste', 'концентрат'],
	'Peeled Tomatoes': ['белени домати', 'домат', 'tomatoes'],
	'Sunflower Oil': ['слънчогледово масло', 'olio', 'veg oil'],
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

async function apiChat(
	messages: ChatTurn[],
	dealContext: string,
	locale: Lang,
	signal: AbortSignal | undefined,
	persona: ChatPersona,
	farmerContext: string,
): Promise<string> {
	const normalizeAssistantReply = (raw: string): string => {
		const stripFallbackMeta = (text: string): string => {
			return text
				.replace(/\n+\s*Ниво на увереност:[\s\S]*$/i, '')
				.replace(/\n+\s*Confidence:\s*LOW[\s\S]*$/i, '')
				.trim();
		};

		const tryParseJsonPrefix = (text: string): Record<string, unknown> | null => {
			const start = text.indexOf('{');
			if (start < 0) return null;
			let depth = 0;
			let inString = false;
			let escaped = false;
			for (let i = start; i < text.length; i += 1) {
				const ch = text[i];
				if (inString) {
					if (escaped) {
						escaped = false;
						continue;
					}
					if (ch === '\\') {
						escaped = true;
						continue;
					}
					if (ch === '"') inString = false;
					continue;
				}
				if (ch === '"') {
					inString = true;
					continue;
				}
				if (ch === '{') depth += 1;
				if (ch === '}') {
					depth -= 1;
					if (depth === 0) {
						const candidate = text.slice(start, i + 1);
						try {
							const parsed = JSON.parse(candidate) as Record<string, unknown>;
							return parsed && typeof parsed === 'object' ? parsed : null;
						} catch {
							return null;
						}
					}
				}
			}
			return null;
		};

		const cleanedRaw = stripFallbackMeta(raw);
		const t = cleanedRaw.trim();
		if (!t.startsWith('{')) return cleanedRaw;
		try {
			const parsed = (JSON.parse(t) as Record<string, unknown>) ?? tryParseJsonPrefix(t);
			if (!parsed || typeof parsed !== 'object' || !('answer' in parsed)) return cleanedRaw;
			const answer = (parsed as { answer?: unknown }).answer;
			if (typeof answer === 'string' && answer.trim()) return answer.trim();
			if (answer && typeof answer === 'object' && !Array.isArray(answer)) {
				const parts: string[] = [];
				for (const [k, v] of Object.entries(answer as Record<string, unknown>)) {
					if (typeof v === 'string' && v.trim()) parts.push(`${k}\n${v.trim()}`);
				}
				if (parts.length > 0) return parts.join('\n\n');
			}
			return cleanedRaw;
		} catch {
			const parsed = tryParseJsonPrefix(t);
			if (parsed && 'answer' in parsed) {
				const answer = (parsed as { answer?: unknown }).answer;
				if (typeof answer === 'string' && answer.trim()) return answer.trim();
				if (answer && typeof answer === 'object' && !Array.isArray(answer)) {
					const parts: string[] = [];
					for (const [k, v] of Object.entries(answer as Record<string, unknown>)) {
						if (typeof v === 'string' && v.trim()) parts.push(`${k}\n${v.trim()}`);
					}
					if (parts.length > 0) return parts.join('\n\n');
				}
			}
			return cleanedRaw;
		}
	};

	/** Mistral + дълъг system prompt + JSON mode често >15s; Vercel api/chat max 60s. */
	const timeoutMs = 60000;
	const maxAttempts = 2;
	const requestBody = JSON.stringify({
		messages,
		dealContext,
		locale,
		persona,
		farmerContext,
	});

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
			const ct = res.headers.get('content-type') || '';
			const trimmed = rawText.trim();
			const looksLikeHtml =
				trimmed.startsWith('<!DOCTYPE') ||
				trimmed.startsWith('<html') ||
				trimmed.startsWith('<HTML');
			let data: { reply?: string; error?: string; hint?: string } = {};
			if (trimmed) {
				if (looksLikeHtml || (!ct.includes('json') && !trimmed.startsWith('{'))) {
					throw new Error(
						locale === 'bg'
							? `Хостингът върна страница вместо JSON (HTTP ${res.status}). Отворете „Вашият-домейн/api/chat“ — очаква се JSON с llmConfigured / mistralConfigured. Във Vercel: задайте MISTRAL_API_KEY или OPENAI_API_KEY за Production, проверете че проектът деплойва папка api/ и домейнът сочи същия проект; Logs → Functions.`
							: `Host returned a page instead of JSON (HTTP ${res.status}). Open /api/chat — expect JSON with llmConfigured / mistralConfigured. On Vercel set MISTRAL_API_KEY or OPENAI_API_KEY for Production, ensure this deployment includes the api/ folder and the domain targets this project; check Functions logs.`
					);
				}
				try {
					data = JSON.parse(trimmed) as typeof data;
				} catch {
					throw new Error(
						locale === 'bg'
							? `Сървърът не върна валиден JSON (код ${res.status}). Проверете дали /api/chat се деплойва (папка api/) и логовете във Vercel.`
							: `Server did not return valid JSON (HTTP ${res.status}). Verify /api/chat is deployed and check Vercel function logs.`
					);
				}
			}
			if (!res.ok) {
				throw new Error(
					data.error ||
						data.hint ||
						(locale === 'bg' ? 'Грешка при чат заявка' : 'Chat request failed')
				);
			}
			if (!data.reply) {
				throw new Error(locale === 'bg' ? 'Празен AI отговор' : 'Empty AI response');
			}
			return normalizeAssistantReply(data.reply);
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

/**
 * Map `visualViewport` to CSS vars for the software keyboard (Chrome Android, iPhone Safari, etc.).
 */
function syncVisualViewportInsets(): void {
	const vv = typeof window !== 'undefined' ? window.visualViewport : null;
	if (!vv) return;
	const cover = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
	document.documentElement.style.setProperty('--keyboard-cover', `${cover}px`);
	document.documentElement.style.setProperty('--vv-height', `${vv.height}px`);
	document.body.toggleAttribute('data-vk-open', cover > 56);
}

function isIosTouchDevice(): boolean {
	if (typeof navigator === 'undefined') return false;
	const ua = navigator.userAgent;
	const ipadOs13Plus =
		navigator.platform === 'MacIntel' && typeof navigator.maxTouchPoints === 'number'
			? navigator.maxTouchPoints > 1
			: false;
	return /iPad|iPhone|iPod/.test(ua) || ipadOs13Plus;
}

/** More passes on iOS Safari — keyboard animation finishes later than on Chrome Android. */
function scheduleViewportResyncForKeyboard(): void {
	const ios =
		typeof document !== 'undefined' && document.documentElement.classList.contains('ios');
	const delays = ios ? ([0, 120, 320, 600, 950] as const) : ([0, 90, 220, 480] as const);
	for (const ms of delays) {
		window.setTimeout(() => syncVisualViewportInsets(), ms);
	}
}

if (typeof document !== 'undefined' && isIosTouchDevice()) {
	document.documentElement.classList.add('ios');
}

/** Compact mobile nav caption; `hint` becomes tooltip + clearer aria when provided. */
function MobileNavLabel({ text, hint }: { text: string; hint?: string }) {
	const title = hint ?? text;
	return (
		<span className="mobile-nav-label" title={title}>
			{text}
		</span>
	);
}

export default function App() {
	const { user: supabaseUser } = useSupabaseSession();
	const [view, setView] = useState<View>('landing');
	const [navMenuOpen, setNavMenuOpen] = useState<'markets' | 'farm' | 'logistics' | null>(null);
	const [mobileNavExpand, setMobileNavExpand] = useState<'markets' | 'farm' | 'logistics' | null>(
		null
	);
	const navFlyoutRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		setNavMenuOpen(null);
		setMobileNavExpand(null);
	}, [view]);

	useEffect(() => {
		if (view !== 'assistant') return;
		const mq = window.matchMedia('(max-width: 768px)');
		const sync = () => setAssistantToolbarCollapsed(mq.matches);
		sync();
		mq.addEventListener('change', sync);
		return () => mq.removeEventListener('change', sync);
	}, [view]);

	useEffect(() => {
		const onDoc = (e: MouseEvent) => {
			const el = navFlyoutRef.current;
			if (!el || !(e.target instanceof Node)) return;
			if (!el.contains(e.target)) setNavMenuOpen(null);
		};
		document.addEventListener('mousedown', onDoc);
		return () => document.removeEventListener('mousedown', onDoc);
	}, []);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				setNavMenuOpen(null);
				setMobileNavExpand(null);
			}
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, []);

	/** Mobile browsers: track visual viewport so chat bar & bottom nav stay above the software keyboard. */
	useEffect(() => {
		const vv = typeof window !== 'undefined' ? window.visualViewport : null;
		if (!vv) return;

		vv.addEventListener('resize', syncVisualViewportInsets);
		vv.addEventListener('scroll', syncVisualViewportInsets);
		window.addEventListener('resize', syncVisualViewportInsets);
		syncVisualViewportInsets();
		return () => {
			vv.removeEventListener('resize', syncVisualViewportInsets);
			vv.removeEventListener('scroll', syncVisualViewportInsets);
			window.removeEventListener('resize', syncVisualViewportInsets);
			document.documentElement.style.removeProperty('--keyboard-cover');
			document.documentElement.style.removeProperty('--vv-height');
			document.body.removeAttribute('data-vk-open');
		};
	}, []);

	useEffect(() => {
		if (!MVP_MODE) return;
		if (view === 'clients' || view === 'watchlist') {
			setView('landing');
		}
	}, [view]);
	const [lang, setLang] = useState<Lang>(() => parseStoredLang(safeLocalGet('agrinexus-lang')));
	const [cookieConsent, setCookieConsent] = useState<CookieConsent | null>(() => {
		const stored = safeLocalGet(COOKIE_CONSENT_KEY);
		return stored === 'accepted' || stored === 'rejected' ? stored : null;
	});

	const browserOrigin = typeof window !== 'undefined' ? window.location.origin : '';
	const isLikelyLocalDev =
		typeof window !== 'undefined' &&
		(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

	useEffect(() => {
		document.documentElement.lang = lang === 'bg' ? 'bg' : 'en';
		document.documentElement.dir = 'ltr';
	}, [lang]);

	useEffect(() => {
		if (view === 'assistant') {
			document.body.setAttribute('data-assistant-route', '');
		} else {
			document.body.removeAttribute('data-assistant-route');
		}
		return () => document.body.removeAttribute('data-assistant-route');
	}, [view]);

	useEffect(() => {
		if (cookieConsent !== 'accepted') return;
		recordBrowserVisitOncePerSession();
	}, [cookieConsent]);

	useEffect(() => {
		if (!cookieConsent) return;
		safeLocalSet(COOKIE_CONSENT_KEY, cookieConsent);
	}, [cookieConsent]);

	const [searchQuery, setSearchQuery] = useState('');
	const [selectedCategory, setSelectedCategory] = useState<DealCategoryFilter>('all');
	const [searchPanelOpen, setSearchPanelOpen] = useState(false);
	const [highlightedDealId, setHighlightedDealId] = useState<number | null>(null);
	const [subsidyPrefillFocus, setSubsidyPrefillFocus] = useState<FarmProductionFocus | null>(null);
	const [subsidyPrefillQuery, setSubsidyPrefillQuery] = useState('');
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
	const [chatPersona, setChatPersona] = useState<ChatPersona>('unified');
	const [chatInput, setChatInput] = useState(
		() => safeSessionGet('agrinexus-chat-draft') ?? ''
	);
	const [pendingAutoChatPrompt, setPendingAutoChatPrompt] = useState<string | null>(null);
	const [chatLoading, setChatLoading] = useState(false);
	const chatAbortRef = useRef<AbortController | null>(null);
	const chatEndRef = useRef<HTMLDivElement | null>(null);
	const chatTextareaRef = useRef<HTMLTextAreaElement | null>(null);
	const [sessionTick, setSessionTick] = useState(0);
	const [voiceListening, setVoiceListening] = useState(false);
	const [docExplainLoading, setDocExplainLoading] = useState(false);
	const [assistantNotice, setAssistantNotice] = useState<string | null>(null);
	const [assistantToolbarCollapsed, setAssistantToolbarCollapsed] = useState(() =>
		typeof window !== 'undefined' ? window.matchMedia('(max-width: 768px)').matches : false,
	);
	const [selectedFieldCityId, setSelectedFieldCityId] = useState<string>('dobrich');
	const docImageInputRef = useRef<HTMLInputElement>(null);
	const selectedFieldCity =
		FIELD_WATCH_OBLAST_CITIES.find((city) => city.id === selectedFieldCityId) ??
		FIELD_WATCH_OBLAST_CITIES[0];
	const speechRef = useRef<SpeechRecognitionInstance | null>(null);

	const demoSessionEmail = useMemo(() => {
		const e = safeLocalGet('agrinexus-demo-email');
		return e?.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()) ? e.trim() : null;
	}, [sessionTick]);
	const cloudAccountEmail = useMemo(() => {
		const e = supabaseUser?.email?.trim() ?? '';
		return e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
	}, [supabaseUser?.email]);
	/** Имейл за идентификация към /api/document-explain: демо localStorage или реален Supabase потребител. */
	const identityEmailForAi = demoSessionEmail ?? cloudAccountEmail;
	const [chatHealth, setChatHealth] = useState<'idle' | 'ready' | 'no_key' | 'offline'>('idle');
	/** Микрофон и снимка на документ: LLM на сървъра ИЛИ регистриран/влязъл потребител (облак или демо имейл). */
	const mediaAiUnlocked = useMemo(
		() => chatHealth === 'ready' || Boolean(identityEmailForAi),
		[chatHealth, identityEmailForAi],
	);

	const [regFullName, setRegFullName] = useState('');
	const [regEmail, setRegEmail] = useState('');
	const [regPassword, setRegPassword] = useState('');
	const [regStatus, setRegStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle');
	const [regMsg, setRegMsg] = useState('');

	const [loginEmail, setLoginEmail] = useState('');
	const [loginPassword, setLoginPassword] = useState('');
	const [loginMsg, setLoginMsg] = useState('');

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
	const supabaseRegisterEnabled = useMemo(() => getSupabaseBrowserClient() !== null, []);
	const regPasswordOkForCloud = regPassword.length >= 6;
	const canSubmitRegister =
		isValidEmail(regEmail) && (!supabaseRegisterEnabled || regPasswordOkForCloud);
	const showRegisterEmailError = regEmail.trim().length > 0 && !isValidEmail(regEmail);
	const showRegisterPasswordError =
		supabaseRegisterEnabled && regPassword.length > 0 && !regPasswordOkForCloud;
	const showContactEmailError = contactEmail.trim().length > 0 && !isValidEmail(contactEmail);
	const invalidEmailText =
		lang === 'bg'
			? 'Моля, въведи валиден имейл адрес.'
			: 'Please enter a valid email address.';

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

		return Array.from({ length: 30 }, (_, i) => {
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

	const filteredDeals = useMemo(() => {
		const rawQ = searchQuery;
		const matchesCategory = (d: SearchableDeal) =>
			selectedCategory === 'all' || d.category === selectedCategory;
		const rows = searchableDeals.filter(d => {
			if (!matchesCategory(d)) return false;
			const score = scoreDealSearchMatch(d.searchText, rawQ);
			return score > 0;
		});
		const ql = rawQ.trim();
		if (!ql) return rows;
		return [...rows].sort(
			(a, b) =>
				scoreDealSearchMatch(b.searchText, rawQ) - scoreDealSearchMatch(a.searchText, rawQ)
		);
	}, [searchableDeals, searchQuery, selectedCategory]);

	useEffect(() => {
		const hasQuery = searchQuery.trim().length > 0;
		setSearchPanelOpen(hasQuery);
		if (!hasQuery) setHighlightedDealId(null);
	}, [searchQuery]);

	const inferSubsidyFocusFromMarket = useCallback(
		(category: DealCategoryFilter, query: string): FarmProductionFocus => {
			const q = `${query} ${category}`.toLowerCase();
			if (
				q.includes('vine') ||
				q.includes('grape') ||
				q.includes('wine') ||
				q.includes('вино') ||
				q.includes('лозе') ||
				q.includes('лозя') ||
				q.includes('грозд')
			) {
				return 'vine';
			}
			if (
				q.includes('vegetable') ||
				q.includes('fruit') ||
				q.includes('hort') ||
				q.includes('orchard') ||
				q.includes('овощ') ||
				q.includes('ябълк') ||
				q.includes('круша') ||
				q.includes('домати') ||
				q.includes('tomato') ||
				q.includes('краставиц') ||
				q.includes('картоф') ||
				q.includes('плод') ||
				q.includes('зеленчук')
			) {
				return 'horticulture';
			}
			if (
				q.includes('cow') ||
				q.includes('cattle') ||
				q.includes('livestock') ||
				q.includes('млек') ||
				q.includes('овце') ||
				q.includes('крав') ||
				q.includes('живот')
			) {
				return 'livestock';
			}
			if (
				q.includes('sunflower') ||
				q.includes('rape') ||
				q.includes('canola') ||
				q.includes('слънчоглед') ||
				q.includes('рапица') ||
				q.includes('масло') ||
				category === 'Oilseeds'
			) {
				return 'mixed';
			}
			if (
				q.includes('wheat') ||
				q.includes('barley') ||
				q.includes('corn') ||
				q.includes('maize') ||
				q.includes('пшеница') ||
				q.includes('ечемик') ||
				q.includes('царевица') ||
				q.includes('зърн') ||
				category === 'Grains'
			) {
				return 'grain';
			}
			if (category === 'Pulses') return 'mixed';
			return 'mixed';
		},
		[]
	);

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

	const sendChat = useCallback(async (opts?: SendChatOpts) => {
		const trimmed = (opts?.text ?? chatInput).trim();
		const personaForRequest = opts?.persona ?? chatPersona;
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
			const farmerSnap = buildFarmerContextForAi(lang);
			const reply = await apiChat(
				payload,
				dealContextForAI,
				lang,
				controller.signal,
				personaForRequest,
				farmerSnap,
			);
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
			let normalized = msg;
			if (msg.includes('OpenAI is not configured')) {
				normalized =
					lang === 'bg'
						? 'AI не е конфигуриран на сървъра. Добавете OPENAI_API_KEY в променливите на средата (напр. Vercel).'
						: 'AI is not configured on the server. Add OPENAI_API_KEY to environment variables (e.g. Vercel).';
			} else if (/incorrect api key|invalid_api_key|authentication/i.test(msg)) {
				normalized =
					lang === 'bg'
						? 'Ключът за OpenAI не е приет (грешен, оттеглен или с интервал). Вземете нов секретен ключ от platform.openai.com/api-keys, сложете го в .env като OPENAI_API_KEY=sk-... без кавички, рестартирайте npm run dev; за Vercel — обновете Environment Variables.'
						: 'OpenAI rejected the API key (wrong, revoked, or extra spaces). Create a new secret at platform.openai.com/api-keys, set OPENAI_API_KEY in .env (no quotes), restart npm run dev; update Vercel env for production.';
			}
			setChatMessages(prev => [...prev, { role: 'assistant', content: normalized }]);
		} finally {
			if (chatAbortRef.current === controller) chatAbortRef.current = null;
			setChatLoading(false);
		}
	}, [chatInput, chatLoading, chatMessages, dealContextForAI, lang, chatPersona]);

	const runQuickPrompt = useCallback(
		(item: AssistantQuickPromptItem) => {
			if (chatLoading) return;
			const text = quickPromptLabel(item, lang);
			setChatPersona(item.persona);
			void sendChat({ text, persona: item.persona });
		},
		[chatLoading, lang, sendChat],
	);

	useEffect(() => {
		if (view !== 'assistant' || !pendingAutoChatPrompt || chatLoading) return;
		const prompt = pendingAutoChatPrompt;
		setPendingAutoChatPrompt(null);
		void sendChat({ text: prompt });
	}, [view, pendingAutoChatPrompt, chatLoading, sendChat]);

	const toggleVoiceInput = useCallback(() => {
		if (!mediaAiUnlocked) {
			setAssistantNotice(
				lang === 'bg'
					? 'Микрофонът е достъпен след конфигуриран LLM на сървъра, след регистрация и вход с облачен акаунт, или след демо вход с имейл.'
					: 'Microphone unlocks when a server LLM is configured, after you register and sign in with your cloud account, or after demo sign-in with email.'
			);
			return;
		}
		if (voiceListening) {
			try {
				speechRef.current?.stop();
			} catch {
				/* ignore */
			}
			speechRef.current = null;
			setVoiceListening(false);
			return;
		}
		const Ctor = getSpeechRecognitionCtor();
		if (!Ctor) {
			setAssistantNotice(
				lang === 'bg'
					? 'Този браузър не поддържа гласово разпознаване — опитайте Chrome или Edge.'
					: 'Speech recognition is not supported — try Chrome or Edge.'
			);
			return;
		}
		const rec = new Ctor();
		rec.lang = speechRecognitionLang(lang);
		rec.continuous = false;
		rec.interimResults = false;
		rec.onresult = (ev: SpeechRecognitionResultEvt) => {
			const t = ev.results[0]?.[0]?.transcript?.trim();
			if (t)
				setChatInput(prev => {
					const next = prev.trim() ? `${prev.trim()} ${t}` : t;
					return next.trim();
				});
		};
		rec.onerror = () => {
			setVoiceListening(false);
			speechRef.current = null;
			setAssistantNotice(lang === 'bg' ? 'Грешка при разпознаване на глас.' : 'Speech recognition error.');
		};
		rec.onend = () => {
			setVoiceListening(false);
			speechRef.current = null;
		};
		speechRef.current = rec;
		setVoiceListening(true);
		try {
			rec.start();
		} catch {
			setVoiceListening(false);
			speechRef.current = null;
			setAssistantNotice(
				lang === 'bg' ? 'Неуспешно стартиране на микрофона.' : 'Could not start microphone.'
			);
		}
	}, [mediaAiUnlocked, voiceListening, lang]);

	const onDocImageChange = useCallback(
		async (e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			e.target.value = '';
			if (!file || docExplainLoading) return;
			if (!mediaAiUnlocked) {
				setAssistantNotice(
					lang === 'bg'
						? 'Обяснение на снимка: нужен е LLM на сървъра, или регистрация и облачен вход, или демо вход с имейл.'
						: 'Document photo: configure a server LLM, or register and use cloud sign-in, or demo email sign-in.'
				);
				return;
			}
			if (!file.type.startsWith('image/')) {
				setAssistantNotice(
					lang === 'bg' ? 'Избери изображение (JPEG, PNG, WebP, GIF).' : 'Choose an image file.'
				);
				return;
			}
			if (file.size > 5 * 1024 * 1024) {
				setAssistantNotice(lang === 'bg' ? 'Файлът е над 5 MB.' : 'File is over 5 MB.');
				return;
			}

			const reader = new FileReader();
			reader.onload = async () => {
				const result = reader.result;
				if (typeof result !== 'string') return;

				const comma = result.indexOf(',');
				const b64 = comma >= 0 ? result.slice(comma + 1) : result;

				const userLabel =
					lang === 'bg' ? `[Документ — снимка] ${file.name}` : `[Document image] ${file.name}`;
				setChatMessages(prev => [...prev, { role: 'user', content: userLabel }]);
				setDocExplainLoading(true);
				try {
					const q = chatInput.trim();
					const res = await fetch('/api/document-explain', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							...(identityEmailForAi ? { sessionEmail: identityEmailForAi } : {}),
							locale: lang,
							imageBase64: b64,
							mimeType: file.type || 'image/jpeg',
							...(q ? { question: q } : {}),
						}),
					});
					let data: { reply?: string; error?: string; hint?: string } = {};
					try {
						data = (await res.json()) as typeof data;
					} catch {
						data = {};
					}
					const text =
						res.ok && data.reply
							? data.reply
							: data.hint ||
								data.error ||
								(lang === 'bg'
									? 'Грешка при обяснение на документ.'
									: 'Document explain failed.');
					setChatMessages(prev => [...prev, { role: 'assistant', content: text }]);
				} catch {
					setChatMessages(prev => [
						...prev,
						{
							role: 'assistant',
							content:
								lang === 'bg'
									? 'Мрежова грешка към /api/document-explain.'
									: 'Network error calling /api/document-explain.',
						},
					]);
				} finally {
					setDocExplainLoading(false);
				}
			};
			reader.readAsDataURL(file);
		},
		[mediaAiUnlocked, identityEmailForAi, docExplainLoading, lang, chatInput]
	);

	useEffect(() => {
		const onStorage = (ev: StorageEvent) => {
			if (ev.key === 'agrinexus-demo-email') setSessionTick(t => t + 1);
		};
		window.addEventListener('storage', onStorage);
		return () => window.removeEventListener('storage', onStorage);
	}, []);

	useEffect(() => {
		if (!assistantNotice) return;
		const t = window.setTimeout(() => setAssistantNotice(null), 6500);
		return () => window.clearTimeout(t);
	}, [assistantNotice]);

	useEffect(() => () => {
		try {
			speechRef.current?.stop();
		} catch {
			/* ignore */
		}
		speechRef.current = null;
	}, []);

	useEffect(() => {
		safeSessionSet('agrinexus-chat-draft', chatInput);
	}, [chatInput]);

	useEffect(() => {
		if (view !== 'assistant') return;
		chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
	}, [chatMessages, chatLoading, view]);

	useEffect(() => () => chatAbortRef.current?.abort(), []);

	useEffect(() => {
		const media = window.matchMedia('(max-width: 900px)');
		const updateMobile = () => setIsMobileViewport(media.matches);
		updateMobile();
		media.addEventListener('change', updateMobile);
		return () => media.removeEventListener('change', updateMobile);
	}, []);

	useEffect(() => {
		if (view !== 'assistant') {
			setChatHealth('idle');
			return;
		}
		let cancelled = false;
		setChatHealth('idle');
		fetch('/api/chat')
			.then(async res => {
				const raw = await res.text();
				if (cancelled) return;
				try {
					const data = JSON.parse(raw) as {
						llmConfigured?: boolean;
						openaiConfigured?: boolean;
						mistralConfigured?: boolean;
						ollamaConfigured?: boolean;
					};
					const llmReady =
						typeof data.llmConfigured === 'boolean'
							? data.llmConfigured
							: Boolean(
									data.mistralConfigured ||
										data.ollamaConfigured ||
										data.openaiConfigured
								);
					setChatHealth(llmReady ? 'ready' : 'no_key');
				} catch {
					setChatHealth('offline');
				}
			})
			.catch(() => {
				if (!cancelled) setChatHealth('offline');
			});
		return () => {
			cancelled = true;
		};
	}, [view]);

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
		setRegStatus('loading');
		setRegMsg('');
		try {
			const res = await fetch('/api/register-interest', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					fullName: regFullName.trim(),
					companyName: '',
					businessEmail: regEmail,
					phone: '',
					marketFocus: '',
					subscribeAlerts: false,
					locale: lang === 'bg' ? 'bg' : 'en',
				}),
			});
			let data: {
				ok?: boolean;
				error?: string;
				hint?: string;
				preview?: string;
				mailDelivery?: 'sent' | 'skipped';
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
			const supabaseClient = getSupabaseBrowserClient();
			let cloudAuthMsg: string | null = null;
			if (supabaseClient) {
				const redirect = `${window.location.origin}${window.location.pathname}`;
				const display =
					regFullName.trim().length >= 2
						? regFullName.trim()
						: regEmail.trim().split('@')[0] || '';
				const { data: signUpData, error } = await supabaseClient.auth.signUp({
					email: regEmail.trim(),
					password: regPassword,
					options: {
						emailRedirectTo: redirect,
						data: {
							full_name: display,
							// Keep legacy metadata keys to satisfy existing DB triggers/policies
							// in Supabase projects that expect these fields on signup.
							company_name: 'Not specified',
							market_focus: '—',
							phone: '',
						},
					},
				});
				if (error) {
					cloudAuthMsg =
						`${tr.registerCloudSignupFailedLeadSaved} ${error.message}`.trim();
				} else if (signUpData.session) {
					cloudAuthMsg = tr.registerCloudSignupOkSession;
				} else {
					cloudAuthMsg = tr.registerCloudSignupCheckEmail;
				}
			}
			if (data.mailDelivery === 'skipped') {
				setRegMsg(
					lang === 'bg'
						? 'Заявката е приета, но имейлът не е изпратен: на сървъра задайте RESEND_API_KEY и MAIL_FROM (напр. във Vercel → Environment Variables).'
						: 'Request received, but no email was sent: set RESEND_API_KEY and MAIL_FROM on the server (e.g. Vercel → Environment Variables).'
				);
			} else {
				setRegMsg(
					lang === 'bg'
						? 'Заявката е изпратена към екипа — очаквайте потвърждение на посочения имейл.'
						: 'Your request was sent to our team — please expect a confirmation at the email you provided.'
				);
			}
			if (cloudAuthMsg) {
				setRegMsg((prev) => (prev ? `${prev}\n${cloudAuthMsg}` : cloudAuthMsg));
			}
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
					locale: lang === 'bg' ? 'bg' : 'en',
				}),
			});
			let data: {
				ok?: boolean;
				error?: string;
				hint?: string;
				mailDelivery?: 'sent' | 'skipped';
			} = {};
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
			if (data.mailDelivery === 'skipped') {
				setContactFeedback(
					lang === 'bg'
						? 'Съобщението е прието, но имейлът не е изпратен: на сървъра задайте RESEND_API_KEY и MAIL_FROM (напр. във Vercel).'
						: 'Message received, but no email was sent: set RESEND_API_KEY and MAIL_FROM on the server (e.g. in Vercel).'
				);
			} else {
				setContactFeedback(
					lang === 'bg'
						? 'Съобщението е изпратено към екипа — очаквайте отговор на посочения имейл.'
						: 'Your message was sent to our team — expect a reply at the email you provided.'
				);
			}
			setContactBody('');
		} catch {
			setContactStatus('err');
			setContactFeedback(lang === 'bg' ? 'Мрежова грешка.' : 'Network error.');
		}
	};

	const handleDemoSignIn = () => {
		setLoginMsg('');
		if (!isValidEmail(loginEmail)) {
			setLoginMsg(
				lang === 'bg'
					? 'Въведи валиден имейл, за да продължиш към демо изгледа.'
					: 'Enter a valid email to continue to the demo workspace.'
			);
			return;
		}
		if (loginPassword.trim().length < 4) {
			setLoginMsg(
				lang === 'bg'
					? 'За демо въведи поне 4 знака в полето за парола (не се изпраща към сървъра).'
					: 'For demo, enter at least 4 characters in the password field (not sent to any server).'
			);
			return;
		}
		safeLocalSet('agrinexus-demo-email', loginEmail.trim());
		setSessionTick(t => t + 1);
		setView('company');
	};

	const tr = useMemo(() => getUiStrings(lang), [lang]);

	const marketBannerMessage = useMemo(() => {
		if (quotesLoading && marketQuotes === null) return tr.marketQuotesLoading;
		if (!marketQuotes || (marketQuotes.ok && marketQuotes.mode === 'demo'))
			return tr.demoMarketBanner;
		if (marketQuotes.ok && marketQuotes.mode === 'live') {
			const ts = marketQuotes.fetchedAt
				? new Date(marketQuotes.fetchedAt).toLocaleString(localeTagFor(lang), {
						dateStyle: 'short',
						timeStyle: 'medium',
					})
				: '';
			return ts ? `${tr.liveMarketBannerStooq} (${ts})` : tr.liveMarketBannerStooq;
		}
		return `${tr.liveMarketErrorBanner}${marketQuotes.error ? ` (${marketQuotes.error})` : ''}`;
	}, [quotesLoading, marketQuotes, tr, lang]);

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

	return (
		<div className="app">
			<style>{`
        :root {
          --bg: #0a110e;
          --panel: #141f18;
          --panel-2: #0e1712;
          --panel-elevated: rgba(18, 29, 22, 0.9);
          --border: #2e4338;
          --border-soft: rgba(190, 231, 207, 0.12);
          --text-main: #f4faf7;
          --text-muted: #9eb8aa;
          --accent: #7ccd9c;
          --accent-muted: rgba(124, 205, 156, 0.16);
          --accent-border: rgba(124, 205, 156, 0.38);
          --accent-text: #d7f4e4;
          --danger: #f87171;
          --gold: #d4b876;
        }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          font-family: 'DM Sans', Inter, system-ui, Segoe UI, Arial, sans-serif;
          background: var(--bg);
          color: var(--text-main);
        }
        .app {
          position: relative;
          min-height: 100vh;
          color: var(--text-main);
          display: flex;
          flex-direction: column;
          background-color: var(--bg);
          background-image:
            linear-gradient(165deg, rgba(22, 48, 38, 0.9) 0%, rgba(12, 26, 20, 0.93) 42%, rgba(7, 14, 11, 0.95) 100%),
            linear-gradient(180deg, rgba(72, 130, 110, 0.14) 0%, transparent 38%),
            url('/season-cal/young_crop.jpg');
          background-position: center, center, center;
          background-size: auto, auto, cover;
          background-repeat: no-repeat;
          background-attachment: fixed;
        }
        /* Фин film-grain върху целия фон (SVG turbulence — без допълнителни HTTP заявки). */
        .app::after {
          content: '';
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 1;
          opacity: 0.042;
          mix-blend-mode: overlay;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Cfilter id='n' x='0' y='0'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.78' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-size: cover;
        }
        @media (prefers-contrast: more) {
          .app::after { opacity: 0; }
        }
        @media (max-width: 900px) {
          .app { background-attachment: scroll; }
        }
        main#main-content {
          flex: 1;
          position: relative;
          z-index: 2;
        }

        .site-footer {
          position: relative;
          z-index: 2;
          border-top: 1px solid var(--border);
          background: rgba(14, 22, 18, 0.94);
          backdrop-filter: blur(10px);
          padding: 18px 16px 22px;
        }
        .site-footer-inner {
          max-width: 1100px;
          margin: 0 auto;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .site-footer-copy { margin: 0; font-size: .82rem; line-height: 1.45; max-width: 52ch; }
        .site-footer-links { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .footer-link-btn {
          background: none;
          border: none;
          color: var(--accent-text);
          cursor: pointer;
          font-family: inherit;
          font-size: .84rem;
          font-weight: 600;
          text-decoration: underline;
          text-underline-offset: 3px;
          padding: 2px 0;
        }
        .footer-link-btn:hover { color: #e8fff4; }
        .site-footer-sep { color: #7a9385; user-select: none; font-size: .9rem; }
        .legal-panel p { margin: 0 0 12px; }
        .legal-panel p:last-child { margin-bottom: 0; }
        .legal-section .btn { margin-top: 14px; }

        .skip-link {
          position: absolute;
          left: -9999px;
          top: 0;
          z-index: 300;
          padding: 10px 14px;
          border-radius: 10px;
          background: #1a4d38;
          color: #e8fff4;
          font-weight: 700;
          font-size: .9rem;
          text-decoration: none;
          border: 2px solid rgba(255, 255, 255, 0.35);
        }
        .skip-link:focus,
        .skip-link:focus-visible {
          left: 12px;
          top: 12px;
          outline: none;
        }

        @keyframes scrollDeals {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        .nav {
          display: flex; justify-content: space-between; align-items: center; gap: 12px;
          padding: 14px 18px;
          background: rgba(14, 23, 18, 0.82);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border);
          position: sticky; top: 0; z-index: 100; flex-wrap: wrap;
        }
        .brand {
          display: flex; align-items: center; gap: 10px; font-weight: 900; cursor: pointer;
          border: none;
          margin: 0;
          padding: 0;
          font: inherit;
          color: inherit;
          background: transparent;
          border-radius: 10px;
        }
        .brand-wordmark { letter-spacing: .01em; }
        .brand-agri { color: #ffffff; }
        .brand-nexus { color: #a8d98a; }
        .nav-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }

        .nav-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #fff;
          opacity: 0.92;
          padding: 8px 10px;
          border-radius: 8px;
          cursor: pointer;
          border: 1px solid transparent;
        }
        button.nav-link {
          margin: 0;
          font: inherit;
          text-align: inherit;
          background: transparent;
          appearance: none;
          -webkit-appearance: none;
        }
        .nav-link:hover:not(.active) {
          background: rgba(255, 255, 255, 0.06);
          opacity: 1;
        }
        .nav-link.active {
          color: var(--accent-text);
          opacity: 1;
          background: var(--accent-muted);
          border-color: var(--accent-border);
        }
        .nav-link.active svg { color: var(--accent); }

        .nav-dropdown {
          position: relative;
        }
        .nav-dropdown-trigger svg.chevron {
          opacity: 0.85;
        }
        .nav-dropdown-panel {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          min-width: 260px;
          z-index: 120;
          background: rgba(16, 32, 24, 0.97);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 2px;
          box-shadow: 0 16px 48px rgba(0, 0, 0, 0.45);
          backdrop-filter: blur(12px);
        }
        .nav-dropdown-item {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          text-align: start;
          padding: 10px 12px;
          border-radius: 8px;
          border: none;
          background: transparent;
          color: inherit;
          font: inherit;
          cursor: pointer;
          font-weight: 650;
        }
        .nav-dropdown-item:hover {
          background: rgba(255, 255, 255, 0.06);
        }
        .nav-dropdown-item.active {
          color: var(--accent-text);
          background: var(--accent-muted);
          border: 1px solid var(--accent-border);
        }

        .btn {
          border: none; border-radius: 12px; cursor: pointer; font-weight: 700;
          display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 11px 16px;
          font-family: inherit;
        }
        .btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .btn-primary { background: var(--accent); color: #0f1f17; }
        .btn-light { background: #f4faf6; color: #141f18; }
        .btn-outline { background: transparent; color: var(--accent-text); border: 1px solid var(--accent-border); }

        .section {
          max-width: 1220px;
          margin: 0 auto;
          padding: 24px 14px 36px;
          position: relative;
        }
        main#main-content .section:not(.landing-hero) {
          margin-top: 12px;
          border-radius: 20px;
          border: 1px solid var(--border-soft);
          background:
            linear-gradient(170deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 28%, rgba(0, 0, 0, 0.06) 100%),
            rgba(12, 20, 15, 0.52);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.04),
            0 18px 40px rgba(0, 0, 0, 0.28);
          backdrop-filter: blur(5px);
        }
        .section h2 {
          margin: 0 0 16px;
          letter-spacing: -0.01em;
          font-size: clamp(1.32rem, 2.2vw, 1.78rem);
        }
        .section h3 {
          letter-spacing: -0.01em;
        }
        .hero { text-align: center; padding-top: 42px; }
        .hero h1 {
          font-size: clamp(2.1rem, 8vw, 4.6rem);
          margin: 0 0 12px;
          letter-spacing: -0.02em;
          text-shadow: none;
        }

        /* Отделен широк банер с реална снимка само на началната страница (под заглавието). */
        .landing-hero {
          position: relative;
          isolation: isolate;
          min-height: clamp(380px, 62vw, 720px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          padding-top: clamp(18px, 4vw, 40px);
          padding-bottom: 28px;
        }
        .landing-hero::before {
          content: '';
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          top: 0;
          width: min(1180px, calc(100% + 48px));
          height: clamp(420px, 78vw, 820px);
          z-index: 0;
          pointer-events: none;
          border-radius: 0 0 22px 22px;
          overflow: hidden;
          background:
            linear-gradient(185deg, rgba(20, 40, 30, 0.14) 0%, rgba(14, 26, 20, 0.58) 72%, rgba(10, 18, 14, 0.78) 100%),
            url('/season-cal/young_crop.jpg') center 46% / cover no-repeat;
          box-shadow:
            inset 0 -40px 48px rgba(8, 14, 11, 0.65),
            0 18px 40px rgba(0, 0, 0, 0.28);
        }
        .landing-hero > * {
          position: relative;
          z-index: 1;
        }
        .landing-hero .brand-wordmark {
          text-shadow: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.04em;
          padding: 0;
          border: none;
          background: transparent;
          backdrop-filter: none;
          -webkit-backdrop-filter: none;
          box-shadow: none;
        }
        .landing-hero .brand-wordmark .brand-agri,
        .landing-hero .brand-wordmark .brand-nexus {
          opacity: 1;
          color: inherit;
          background: none;
          -webkit-text-fill-color: currentColor;
        }
        .landing-hero .brand-wordmark .brand-agri { color: #ffffff; }
        .landing-hero .brand-wordmark .brand-nexus { color: #a8d98a; }

        .landing-hero-inner {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 100%;
          max-width: min(1120px, 100%);
          padding: 0 14px;
        }
        .landing-glass-stack {
          width: 100%;
          margin-top: clamp(14px, 3vw, 26px);
        }
        .landing-glass-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }
        .landing-glass-card {
          background: rgba(14, 24, 19, 0.94);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 18px;
          padding: 18px 20px 20px;
          box-shadow: 0 10px 32px rgba(0, 0, 0, 0.28);
          text-align: left;
        }
        .landing-glass-card h2 {
          margin: 0 0 12px;
          font-size: clamp(1.05rem, 2vw, 1.22rem);
          color: var(--accent-text);
          letter-spacing: -0.02em;
          line-height: 1.25;
        }
        .landing-glass-card p {
          margin: 0 0 10px;
          color: rgba(232, 247, 239, 0.9);
          font-size: 0.9rem;
          line-height: 1.55;
        }
        .landing-glass-card ul {
          margin: 8px 0 16px;
          padding-left: 1.15rem;
          color: rgba(200, 218, 208, 0.93);
          font-size: 0.84rem;
          line-height: 1.48;
        }
        .landing-glass-card li {
          margin-bottom: 7px;
        }
        .landing-glass-card li:last-child {
          margin-bottom: 0;
        }
        .landing-glass-card .btn {
          width: 100%;
          justify-content: center;
          margin-top: 6px;
        }
        .landing-glass-footer {
          margin-top: 22px;
          padding: 12px 10px 6px;
          text-align: center;
        }
        .landing-glass-footer p {
          margin: 0 0 12px;
          font-size: 0.88rem;
          color: var(--text-muted);
          line-height: 1.45;
        }
        .landing-glass-mail-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          text-decoration: none;
        }
        @media (max-width: 820px) {
          .landing-glass-grid {
            grid-template-columns: 1fr;
          }
        }
        .landing-inquiry-strip {
          margin-top: 32px;
          margin-left: -14px;
          margin-right: -14px;
          margin-bottom: 0;
          padding: 18px 14px 22px;
          background: rgba(8, 14, 11, 0.96);
          border-top: 1px solid rgba(212, 168, 83, 0.22);
          box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.35);
        }
        .landing-inquiry-inner {
          display: flex;
          align-items: stretch;
          gap: 0;
          max-width: 720px;
          margin: 0 auto;
          border-radius: 14px;
          border: 1px solid rgba(212, 168, 83, 0.28);
          background: rgba(14, 22, 18, 0.98);
          overflow: hidden;
        }
        .landing-inquiry-ai-mark {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 14px;
          background: rgba(212, 168, 83, 0.12);
          border-right: 1px solid rgba(212, 168, 83, 0.22);
          color: #d4a853;
          flex-shrink: 0;
        }
        .landing-inquiry-bar {
          flex: 1;
          min-width: 0;
          text-align: left;
          border: none;
          border-radius: 0;
          background: transparent;
          color: #a8bfb4;
          font: inherit;
          font-size: 0.92rem;
          padding: 14px 16px;
          cursor: pointer;
        }
        .landing-inquiry-bar:hover {
          background: rgba(255, 255, 255, 0.04);
          color: #e8fff4;
        }
        .landing-inquiry-hint {
          margin: 10px 0 0;
          text-align: center;
          font-size: 0.68rem;
          letter-spacing: 0.14em;
          color: #6b8579;
          text-transform: uppercase;
        }
        @media (max-width: 900px) {
          .landing-inquiry-strip {
            margin-left: -10px;
            margin-right: -10px;
            padding-left: 12px;
            padding-right: 12px;
            padding-bottom: max(18px, env(safe-area-inset-bottom, 0px));
          }
          .landing-inquiry-ai-mark {
            padding: 0 11px;
          }
          .landing-inquiry-bar {
            min-height: 48px;
          }
        }
        .hero p { color: var(--text-muted); max-width: 860px; margin: 0 auto 20px; }

        .ai-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-top: 22px; }
        .ai-card {
          background: rgba(20, 31, 24, 0.78);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 14px;
          text-align: left;
          backdrop-filter: blur(8px);
        }
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
        .deal-card {
          background: linear-gradient(180deg, rgba(23, 36, 28, 0.94) 0%, rgba(17, 27, 21, 0.9) 100%);
          border: 1px solid rgba(168, 217, 138, 0.14);
          border-radius: 18px;
          padding: 14px;
          position: relative;
          backdrop-filter: blur(10px);
          box-shadow: 0 12px 26px rgba(0, 0, 0, 0.22);
          transition: transform .2s ease, box-shadow .22s ease, border-color .22s ease;
        }
        .deal-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 18px 34px rgba(0, 0, 0, 0.28);
          border-color: rgba(168, 217, 138, 0.26);
        }
        .deal-card.search-hit {
          border-color: rgba(124, 205, 156, 0.72);
          box-shadow: 0 0 0 2px rgba(124, 205, 156, 0.22), 0 18px 34px rgba(0, 0, 0, 0.28);
        }
        .deal-card.top { border: 2px solid var(--accent); }
        .demo-banner {
          background: rgba(124, 205, 156, 0.07);
          border: 1px solid rgba(124, 205, 156, 0.22);
          border-radius: 12px;
          padding: 11px 14px;
          margin-bottom: 14px;
          color: var(--accent-text);
          font-size: .88rem;
          line-height: 1.5;
        }
        .section.assistant-route {
          max-width: min(1400px, 96vw);
          padding-left: max(12px, env(safe-area-inset-left, 0px));
          padding-right: max(12px, env(safe-area-inset-right, 0px));
        }
        .assistant-route-actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 16px;
        }
        .assistant-route-actions-group {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
        }
        .assistant-workbench {
          display: flex;
          flex-direction: column;
          max-height: min(88dvh, 960px);
          padding: 14px !important;
          overscroll-behavior-y: contain;
        }
        @media (max-width: 900px) {
          .assistant-workbench {
            max-height: min(calc(var(--vv-height, 100dvh) - 28px), 960px);
          }
        }
        .assistant-panel-head {
          flex-shrink: 0;
          padding-bottom: 12px;
          margin-bottom: 8px;
          border-bottom: 1px solid var(--border);
          background: var(--panel);
        }
        .assistant-persona-row {
          margin-bottom: 10px !important;
        }
        .assistant-quick-prompts-scroll {
          max-height: 132px;
          overflow-y: auto;
          padding-right: 6px;
          scrollbar-gutter: stable;
        }
        @media (max-width: 640px) {
          .assistant-quick-prompts-scroll {
            max-height: min(120px, 28vh);
          }
        }
        .assistant-prompts-scroll-hint {
          margin: 0 0 6px;
          font-size: 0.72rem;
          line-height: 1.35;
          color: var(--text-muted);
          opacity: 0.92;
        }
        .assistant-msgs {
          flex: 1 1 auto;
          min-height: clamp(200px, 42vh, 520px);
          max-height: none;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin: 0;
          padding: 8px 4px 8px 0;
        }
        html.ios .assistant-msgs {
          -webkit-overflow-scrolling: touch;
        }
        .assistant-panel-foot {
          flex-shrink: 0;
          padding-top: 12px;
          margin-top: 8px;
          border-top: 1px solid var(--border);
          background: var(--panel);
        }
        @media (max-width: 900px) {
          .assistant-panel-foot {
            scroll-margin-bottom: max(24px, env(safe-area-inset-bottom, 0px), var(--keyboard-cover, 0px));
          }
        }
        .assistant-bubble {
          max-width: min(100%, 72rem);
          padding: 12px 14px;
          border-radius: 12px;
          font-size: .935rem;
          line-height: 1.55;
          overflow-wrap: anywhere;
          word-break: break-word;
          white-space: pre-wrap;
        }
        .assistant-bubble.user {
          align-self: flex-end;
          background: rgba(124, 205, 156, 0.1);
          border: 1px solid var(--accent-border);
        }
        .assistant-bubble.assistant {
          align-self: flex-start;
          background: #141f18;
          border: 1px solid #3d5248;
        }
        .assistant-doc-toolbar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }
        .assistant-icon-btn {
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 46px;
          min-height: 46px;
          padding: 10px;
          border-radius: 10px;
          border: 1px solid #3d5248;
          background: #141f18;
          color: #e2e8f0;
          cursor: pointer;
        }
        .assistant-icon-btn:hover:not(:disabled) {
          border-color: var(--accent-border);
          color: var(--accent-text);
        }
        .assistant-icon-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .assistant-icon-btn.listening {
          border-color: rgba(248, 113, 113, 0.65);
          color: #fca5a5;
          animation: pulseMic 1.2s ease-in-out infinite;
        }
        @keyframes pulseMic {
          0%, 100% { box-shadow: 0 0 0 0 rgba(248, 113, 113, 0.35); }
          50% { box-shadow: 0 0 0 6px rgba(248, 113, 113, 0); }
        }
        .assistant-input-row {
          display: flex;
          gap: 8px;
          align-items: flex-end;
          margin-top: 8px;
        }
        .assistant-input-row textarea {
          flex: 1;
          resize: none;
          min-height: 48px;
          max-height: 160px;
          padding: 10px;
          border-radius: 10px;
          border: 1px solid #3d5248;
          background: #101914;
          color: #fff;
          font-family: inherit;
        }
        @media (max-width: 900px) {
          .assistant-input-row textarea {
            font-size: 16px;
            line-height: 1.35;
            touch-action: manipulation;
          }
        }

        .market-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 18px; }
        .ticker-wrap { margin-bottom: 12px; border: 1px solid #2a3d34; border-radius: 10px; background: #101914; overflow: hidden; }
        .ticker-track { display: flex; gap: 20px; width: max-content; padding: 10px 0; animation: scrollDeals 35s linear infinite; }
        .ticker-track:hover { animation-play-state: paused; }
        .ticker-item { white-space: nowrap; font-size: .86rem; color: #cbd5e1; }
        .ticker-item strong { color: var(--accent-text); margin-left: 8px; }
        .market-flash-line {
          margin: 0; flex: 1; min-width: 180px;
          background: rgba(124, 205, 156, 0.06); border: 1px solid rgba(124, 205, 156, 0.22); border-radius: 10px;
          padding: 11px 13px; color: #ccfbf1; font-size: .9rem;
        }
        .terminal-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin: 10px 0 14px; }
        .terminal-metric { background: #101914; border: 1px solid #2a3d34; border-radius: 8px; padding: 8px 10px; }
        .terminal-metric strong { color: var(--accent-text); display: block; font-size: 1.05rem; }
        .terminal-metric span { color: #94a3b8; font-size: .76rem; }
        .deal-actions { margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap; }
        .deal-chip-btn {
          border: 1px solid #3d5248; background: #141f18; color: #cbd5e1; border-radius: 999px;
          padding: 5px 10px; font-size: .74rem; cursor: pointer;
        }
        .deal-chip-btn.active { border-color: var(--accent); color: var(--accent-text); background: var(--accent-muted); }
        .live-dot {
          width: 8px; height: 8px; background: var(--accent); border-radius: 999px; display: inline-block; margin-right: 6px;
          animation: pulseDot 1.6s infinite;
        }
        @keyframes pulseDot {
          0% { box-shadow: 0 0 0 0 rgba(124, 205, 156, .45); }
          100% { box-shadow: 0 0 0 10px rgba(124, 205, 156, 0); }
        }
        .pulse-toolbar {
          display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px;
        }
        .search-wrap { position: relative; width: min(100%, 560px); flex: 1; }
        .search-inline {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .search-input-shell {
          position: relative;
          flex: 1;
          min-width: 0;
        }
        .search-wrap input {
          width: 100%; padding: 12px 12px 12px 42px; border-radius: 12px; outline: none;
          background: #1a2820; color: #fff; border: 1px solid #3d5248;
        }
        .search-icon { position: absolute; left: 13px; top: 11px; color: #64748b; }
        .search-help-note {
          margin: 8px 2px 0;
          color: #9eb8aa;
          font-size: .78rem;
          line-height: 1.4;
        }

        .muted { color: var(--text-muted); }
        .green-note { color: var(--accent-text); font-weight: 700; }
        .contact-panel {
          background: linear-gradient(180deg, rgba(22, 34, 27, 0.92) 0%, rgba(17, 27, 21, 0.9) 100%);
          border: 1px solid rgba(168, 217, 138, 0.14);
          border-radius: 16px;
          padding: 16px;
          margin-top: 16px;
          backdrop-filter: blur(10px);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.035),
            0 14px 30px rgba(0, 0, 0, 0.24);
        }
        .season-cal-month-card {
          margin-top: 0;
          overflow: hidden;
          transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
        }
        .season-cal-month-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 14px 32px rgba(0, 0, 0, 0.38);
          border-color: rgba(124, 205, 156, 0.42);
        }
        .season-cal-crop-btn { display: inline-flex; align-items: center; gap: 8px; }

        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .form-grid input, .form-grid select, .form-grid textarea {
          width: 100%; padding: 11px; border-radius: 10px; border: 1px solid #3d5248; background: #1a2820; color: #fff;
          font-family: inherit;
        }
        .search-wrap input:focus-visible,
        .form-grid input:focus-visible,
        .form-grid select:focus-visible,
        .form-grid textarea:focus-visible,
        .assistant-input-row textarea:focus-visible {
          outline: 2px solid rgba(124, 205, 156, 0.65);
          outline-offset: 2px;
          border-color: var(--accent-border);
        }

        .btn-mini {
          background: transparent; color: #94a3b8; border: 1px solid #3d5248; border-radius: 8px;
          padding: 5px 9px; cursor: pointer; font-size: .76rem;
        }
        .chat-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .clients-layout { display: grid; grid-template-columns: 340px 1fr; gap: 14px; }
        .client-list {
          background: linear-gradient(180deg, rgba(22, 34, 27, 0.92) 0%, rgba(16, 26, 20, 0.9) 100%);
          border: 1px solid rgba(168, 217, 138, 0.14);
          border-radius: 16px;
          padding: 10px;
          backdrop-filter: blur(10px);
          box-shadow: 0 12px 26px rgba(0, 0, 0, 0.2);
        }
        .client-list-item {
          width: 100%; text-align: left; border: 1px solid transparent; background: #141f18; color: #fff;
          padding: 10px; border-radius: 10px; margin-bottom: 8px; cursor: pointer;
        }
        .client-list-item.active { border-color: var(--accent); background: var(--accent-muted); }
        .client-card {
          background: linear-gradient(180deg, rgba(22, 34, 27, 0.92) 0%, rgba(16, 26, 20, 0.9) 100%);
          border: 1px solid rgba(168, 217, 138, 0.14);
          border-radius: 16px;
          padding: 16px;
          backdrop-filter: blur(10px);
          box-shadow: 0 12px 28px rgba(0, 0, 0, 0.24);
        }
        .client-meta-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 12px; }
        .meta-kv {
          background: rgba(15, 24, 19, 0.86);
          border: 1px solid rgba(168, 217, 138, 0.12);
          border-radius: 12px;
          padding: 10px;
        }
        .status-pill {
          display: inline-flex; padding: 4px 8px; border-radius: 999px; font-size: .74rem; font-weight: 700;
          background: var(--accent-muted); color: var(--accent-text);
        }
        .btn:focus-visible,
        .btn-mini:focus-visible,
        .brand:focus-visible,
        .nav-link:focus-visible,
        .deal-chip-btn:focus-visible,
        .client-list-item:focus-visible,
        .mobile-nav-btn:focus-visible,
        .footer-link-btn:focus-visible {
          outline: 2px solid rgba(124, 205, 156, 0.65);
          outline-offset: 2px;
        }
        .mobile-nav { display: none; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.85s linear infinite; display: inline-block; }

        @media (max-width: 700px) {
          .form-grid { grid-template-columns: 1fr; }
          .grid { grid-template-columns: 1fr; }
          .clients-layout, .client-meta-grid { grid-template-columns: 1fr; }
          .terminal-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }

        @media (max-width: 900px) {
          .section { padding: 16px 10px 110px; }
          main#main-content .section:not(.landing-hero) {
            border-radius: 14px;
            margin-top: 8px;
          }
          .nav { padding: 10px 12px; }
          .nav-actions { gap: 6px; }
          .nav-link { padding: 7px 8px; font-size: .86rem; }
          .nav-link-mobile-hide { display: none !important; }
          .btn { padding: 10px 12px; border-radius: 10px; }
          .deal-card, .ai-card, .contact-panel, .client-card { padding: 12px; border-radius: 12px; }
          .deal-card h3 { font-size: 1rem; }
          .muted { font-size: .9rem; }

          .site-footer { padding-bottom: 148px; }

          .mobile-nav {
            position: fixed;
            left: 10px;
            right: 10px;
            bottom: calc(10px + env(safe-area-inset-bottom, 0px) + var(--keyboard-cover, 0px));
            z-index: 160;
            background: rgba(14, 22, 18, 0.97);
            border: 1px solid #3d5248;
            border-radius: 14px;
            padding: 8px;
            display: flex;
            flex-direction: column;
            gap: 4px;
            backdrop-filter: blur(6px);
          }
          html.ios .mobile-nav {
            transform: translateZ(0);
          }
          .mobile-nav-row {
            display: grid;
            grid-template-columns: repeat(5, minmax(0, 1fr));
            gap: 4px;
          }
          .mobile-nav-row.tools {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .mobile-nav-subrow {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 4px;
            padding: 4px 0 0;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
          }
          .mobile-nav-subrow.cols-2 {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .mobile-nav-btn {
            border: 1px solid transparent;
            background: #101914;
            color: #cbd5e1;
            border-radius: 10px;
            padding: 8px 4px;
            min-height: 48px;
            font-size: .65rem;
            font-weight: 700;
            font-family: inherit;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            gap: 4px;
            transition: transform .08s ease, background .2s ease, border-color .2s ease, color .2s ease;
            touch-action: manipulation;
          }
          .mobile-nav-btn:active {
            transform: scale(0.97);
          }
          .mobile-nav-btn svg {
            width: 15px;
            height: 15px;
          }
          .mobile-nav-label {
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
            overflow: hidden;
            width: 100%;
            max-width: 100%;
            min-width: 0;
            line-height: 1.14;
            overflow-wrap: anywhere;
            word-break: break-word;
            hyphens: auto;
          }
          .mobile-nav-btn.active {
            border-color: var(--accent-border);
            color: var(--accent-text);
            background: var(--accent-muted);
          }
          body[data-assistant-route][data-vk-open] .mobile-nav {
            visibility: hidden;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.12s ease;
          }
          body[data-assistant-route][data-vk-open] .section.assistant-route {
            padding-bottom: max(12px, env(safe-area-inset-bottom, 0px));
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .deals-track,
          .ticker-track {
            animation: none !important;
          }
          .live-dot {
            animation: none !important;
          }
          .spin {
            animation: none !important;
          }
          .mobile-nav-btn {
            transition: none;
          }
        }
      `}</style>

			<a href="#main-content" className="skip-link">
				{tr.skipToContent}
			</a>
			<nav className="nav" aria-label={tr.navPrimaryAria}>
				<button type="button" className="brand" onClick={() => setView('landing')} aria-label={tr.brandHomeAria}>
					<Leaf color="#a8d98a" size={24} aria-hidden />
					<span className="brand-wordmark">
						<span className="brand-agri">Agri</span>
						<span className="brand-nexus">Nexus</span>
					</span>
				</button>
				<div className="nav-actions" ref={navFlyoutRef}>
					<button
						type="button"
						className={`nav-link nav-link-mobile-hide ${view === 'landing' ? 'active' : ''}`}
						onClick={() => setView('landing')}>
						{tr.navHome}
					</button>
					<div className="nav-dropdown nav-link-mobile-hide">
						<button
							type="button"
							className={`nav-link nav-dropdown-trigger ${TRADING_VIEWS.has(view) ? 'active' : ''}`}
							aria-expanded={navMenuOpen === 'markets'}
							aria-haspopup="menu"
							onClick={e => {
								e.stopPropagation();
								setNavMenuOpen(prev => (prev === 'markets' ? null : 'markets'));
							}}>
							{tr.navGroupMarkets}{' '}
							<ChevronDown size={14} className="chevron" aria-hidden />
						</button>
						{navMenuOpen === 'markets' && (
							<div className="nav-dropdown-panel" role="menu">
								<button
									type="button"
									role="menuitem"
									className={`nav-dropdown-item ${view === 'market' ? 'active' : ''}`}
									onClick={() => {
										setView('market');
										setNavMenuOpen(null);
									}}>
									<Search size={14} aria-hidden /> {tr.navMarket}
								</button>
								<button
									type="button"
									role="menuitem"
									className={`nav-dropdown-item ${view === 'market-watch' ? 'active' : ''}`}
									onClick={() => {
										setView('market-watch');
										setNavMenuOpen(null);
									}}>
									<LineChart size={14} aria-hidden /> {tr.navMarketWatch}
								</button>
								<button
									type="button"
									role="menuitem"
									className={`nav-dropdown-item ${view === 'crop-statistics' ? 'active' : ''}`}
									onClick={() => {
										setView('crop-statistics');
										setNavMenuOpen(null);
									}}>
									<BarChart3 size={14} aria-hidden /> {tr.navCropStatistics}
								</button>
								<button
									type="button"
									role="menuitem"
									className={`nav-dropdown-item ${view === 'trade-documents' ? 'active' : ''}`}
									onClick={() => {
										setView('trade-documents');
										setNavMenuOpen(null);
									}}>
									<FileText size={14} aria-hidden /> {tr.navTradeDocuments}
								</button>
							</div>
						)}
					</div>
					<div className="nav-dropdown nav-link-mobile-hide">
						<button
							type="button"
							className={`nav-link nav-dropdown-trigger ${FARM_VIEWS.has(view) ? 'active' : ''}`}
							aria-expanded={navMenuOpen === 'farm'}
							aria-haspopup="menu"
							onClick={e => {
								e.stopPropagation();
								setNavMenuOpen(prev => (prev === 'farm' ? null : 'farm'));
							}}>
							{tr.navGroupFarm}{' '}
							<ChevronDown size={14} className="chevron" aria-hidden />
						</button>
						{navMenuOpen === 'farm' && (
							<div className="nav-dropdown-panel" role="menu">
								<button
									type="button"
									role="menuitem"
									className={`nav-dropdown-item ${view === 'field-watch' ? 'active' : ''}`}
									onClick={() => {
										setView('field-watch');
										setNavMenuOpen(null);
									}}>
									<FileImage size={14} aria-hidden /> {lang === 'bg' ? 'Field Watch карта' : 'Field Watch Map'}
								</button>
								<button
									type="button"
									role="menuitem"
									className={`nav-dropdown-item ${view === 'subsidy-calculator' ? 'active' : ''}`}
									onClick={() => {
										setView('subsidy-calculator');
										setNavMenuOpen(null);
									}}>
									<Calculator size={14} aria-hidden /> {tr.navSubsidyCalculator}
								</button>
								<button
									type="button"
									role="menuitem"
									className={`nav-dropdown-item ${view === 'season-calendar' ? 'active' : ''}`}
									onClick={() => {
										setView('season-calendar');
										setNavMenuOpen(null);
									}}>
									<CalendarDays size={14} aria-hidden /> {tr.navSeasonCalendar}
								</button>
								<button
									type="button"
									role="menuitem"
									className={`nav-dropdown-item ${view === 'command' ? 'active' : ''}`}
									onClick={() => {
										setView('command');
										setNavMenuOpen(null);
									}}>
									<ClipboardList size={14} aria-hidden /> {tr.navCommand}
								</button>
							</div>
						)}
					</div>
					<div className="nav-dropdown nav-link-mobile-hide">
						<button
							type="button"
							className={`nav-link nav-dropdown-trigger ${LOGISTICS_VIEWS.has(view) ? 'active' : ''}`}
							aria-expanded={navMenuOpen === 'logistics'}
							aria-haspopup="menu"
							onClick={e => {
								e.stopPropagation();
								setNavMenuOpen(prev => (prev === 'logistics' ? null : 'logistics'));
							}}>
							{tr.navLogistics}{' '}
							<ChevronDown size={14} className="chevron" aria-hidden />
						</button>
						{navMenuOpen === 'logistics' && (
							<div className="nav-dropdown-panel" role="menu">
								<button
									type="button"
									role="menuitem"
									className={`nav-dropdown-item ${view === 'food-security' ? 'active' : ''}`}
									onClick={() => {
										setView('food-security');
										setNavMenuOpen(null);
									}}>
									<Shield size={14} aria-hidden /> {tr.navFoodSecurity}
								</button>
								<button
									type="button"
									role="menuitem"
									className={`nav-dropdown-item ${view === 'file-upload' ? 'active' : ''}`}
									onClick={() => {
										setView('file-upload');
										setNavMenuOpen(null);
									}}>
									<FileUp size={14} aria-hidden /> {tr.portalLogisticsSubFileUpload}
								</button>
							</div>
						)}
					</div>
					{!MVP_MODE && (
						<>
							<button
								type="button"
								className={`nav-link nav-link-mobile-hide ${view === 'clients' ? 'active' : ''}`}
								onClick={() => setView('clients')}>
								{tr.navClients}
							</button>
							<button
								type="button"
								className={`nav-link nav-link-mobile-hide ${view === 'watchlist' ? 'active' : ''}`}
								onClick={() => setView('watchlist')}>
								{tr.navWatchlist}
							</button>
						</>
					)}
					<button
						type="button"
						className={`nav-link nav-link-mobile-hide ${view === 'assistant' ? 'active' : ''}`}
						onClick={() => setView('assistant')}>
						<MessageSquare size={14} aria-hidden /> {tr.navAssistant}
					</button>
					<button
						type="button"
						className={`nav-link nav-link-mobile-hide ${view === 'login' ? 'active' : ''}`}
						onClick={() => setView('login')}>
						<LogIn size={14} aria-hidden /> {tr.navLogin}
					</button>
					<button
						type="button"
						className="btn-mini"
						aria-label={tr.langAria}
						onClick={() => setLang(x => cycleUiLang(x))}>
						<Globe2 size={14} aria-hidden /> {uiLangShortLabel(lang)}
					</button>
					<button type="button" className="btn btn-primary" onClick={() => setView('register')}>
						<UserPlus size={14} aria-hidden /> {tr.navGetStarted}
					</button>
				</div>
			</nav>

			<main id="main-content" tabIndex={-1}>
			{view === 'landing' && (
				<section className="section hero landing-hero">
					<div className="landing-hero-inner">
						<h1 className="brand-wordmark">
							<span className="brand-agri">Agri</span>
							<span className="brand-nexus">Nexus</span>
						</h1>
						<div className="landing-glass-stack">
							<div className="landing-glass-grid">
								<article className="landing-glass-card">
									<h2>{tr.landingGlassMarketTitle}</h2>
									<p>{tr.landingGlassMarketP1}</p>
									<p>{tr.landingGlassMarketP2}</p>
									<button
										type="button"
										className="btn btn-primary"
										onClick={() => setView('market')}
										aria-label={tr.landingGlassMarketCta}>
										<Search size={18} aria-hidden />
										{tr.landingGlassMarketCta}
									</button>
								</article>
								<article className="landing-glass-card">
									<h2>{tr.landingGlassIntelTitle}</h2>
									<p>{tr.landingGlassIntelP1}</p>
									<p style={{ marginBottom: 6, fontSize: '.84rem', fontWeight: 650, color: 'var(--accent-text)' }}>
										{tr.landingGlassIntelListIntro}
									</p>
									<ul>
										<li>{tr.landingGlassIntelLi1}</li>
										<li>{tr.landingGlassIntelLi2}</li>
										<li>{tr.landingGlassIntelLi3}</li>
										<li>{tr.landingGlassIntelLi4}</li>
										<li>{tr.landingGlassIntelLi5}</li>
									</ul>
									<button
										type="button"
										className="btn btn-primary"
										onClick={() => setView('market-watch')}
										aria-label={tr.landingGlassIntelCta}>
										<LineChart size={18} aria-hidden />
										{tr.landingGlassIntelCta}
									</button>
								</article>
							</div>
							<div className="landing-glass-footer">
								<p>{tr.landingGlassFooterLead}</p>
								<button
									type="button"
									className="btn btn-primary"
									onClick={() => setView('field-watch')}
									aria-label={lang === 'bg' ? 'Отвори Field Watch карта' : 'Open Field Watch map'}>
									<FileImage size={18} aria-hidden />
									{lang === 'bg' ? 'Отвори Field Watch' : 'Open Field Watch'}
								</button>
								<a
									className="btn btn-outline landing-glass-mail-btn"
									href="mailto:info@agrinexus.eu"
									aria-label={tr.landingGlassEmailAria}>
									<Mail size={18} aria-hidden />
									info@agrinexus.eu
								</a>
							</div>
						</div>
					</div>
				</section>
			)}

			{view === 'market' && (
				<section className="section">
					<div className="market-head">
						<div className="search-wrap">
							<div className="search-inline">
								<div className="search-input-shell">
									<Search className="search-icon" size={18} />
									<input
										type="text"
										aria-label={lang === 'bg' ? 'Търсене в оферти' : 'Search in deals'}
										placeholder={tr.searchPh}
										value={searchQuery}
										onChange={e => setSearchQuery(e.target.value)}
									/>
								</div>
								<button
									type="button"
									className="btn-mini"
									onClick={() => setSearchQuery(q => q.trim())}>
									{lang === 'bg' ? 'Търси' : 'Search'}
								</button>
							</div>
							<p className="search-help-note">
								{lang === 'bg'
									? 'Това поле е търсачка за оферти. За въпроси използвайте AI Chat.'
									: 'This field filters deals. For questions, use AI Chat.'}
							</p>
						</div>
						<div
							style={{
								display: 'flex',
								alignItems: 'center',
								gap: 10,
								flexWrap: 'wrap',
							}}>
							<button
								type="button"
								className="btn-mini"
								onClick={() => {
									if (searchQuery.trim()) {
										const seed = lang === 'bg'
											? `Искам анализ за: ${searchQuery.trim()}`
											: `I need analysis for: ${searchQuery.trim()}`;
										setChatInput(prev => (prev.trim() ? prev : seed));
									}
									setView('assistant');
								}}>
								<MessageSquare size={16} /> {lang === 'bg' ? 'AI Chat' : 'AI Chat'}
							</button>
							<button type="button" className="btn-mini" onClick={() => setView('market-watch')}>
								<LineChart size={16} aria-hidden /> {tr.navMarketWatchShort}
							</button>
							<button
								type="button"
								className="btn-mini"
								onClick={() => {
									const q = searchQuery.trim();
									setSubsidyPrefillQuery(q);
									setSubsidyPrefillFocus(
										inferSubsidyFocusFromMarket(selectedCategory, q)
									);
									setView('subsidy-calculator');
								}}>
								<Calculator size={16} /> {lang === 'bg' ? 'Към субсидии' : 'To Subsidies'}
							</button>
							<span
								className="muted"
								style={{ fontSize: '.78rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
								<span className="live-dot" style={{ marginRight: 0 }} />
								{lang === 'bg' ? 'Авто-обновяване' : 'Auto refresh'}
							</span>
						</div>
					</div>
					{searchQuery.trim() ? (
						<div className="contact-panel" style={{ marginTop: 0, marginBottom: 12, padding: 12 }}>
							<div
								style={{
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'space-between',
									gap: 10,
									flexWrap: 'wrap',
								}}>
								<strong style={{ fontSize: '.9rem' }}>
									{lang === 'bg'
										? `Намерени оферти: ${filteredDeals.length}`
										: `Found offers: ${filteredDeals.length}`}
								</strong>
								<button
									type="button"
									className="btn-mini"
									onClick={() => setSearchPanelOpen(v => !v)}>
									{searchPanelOpen
										? lang === 'bg'
											? 'Скрий резултатите'
											: 'Hide results'
										: lang === 'bg'
											? 'Покажи резултатите'
											: 'Show results'}
								</button>
							</div>
							{searchPanelOpen ? (
								filteredDeals.length > 0 ? (
									<div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
										{filteredDeals.slice(0, 6).map((deal) => (
											<button
												key={`result-${deal.id}`}
												type="button"
												className="btn-mini"
												style={{ textAlign: 'left', justifyContent: 'flex-start' }}
												onClick={() => {
													setHighlightedDealId(deal.id);
													const el = document.getElementById(`deal-card-${deal.id}`);
													if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
												}}>
												#{deal.id} {deal.product} · {deal.from} → {deal.to}
											</button>
										))}
									</div>
								) : (
									<p className="muted" style={{ margin: '10px 0 0', fontSize: '.85rem' }}>
										{lang === 'bg'
											? 'Няма съвпадения за тази фраза.'
											: 'No matches for this query.'}
									</p>
								)
							) : null}
						</div>
					) : null}
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
									border: '1px solid #3d5248',
									background: '#141f18',
									color: '#fff',
								}}
							/>
						</label>
					</div>

					<div className="grid">
						{filteredDeals.map((deal, i) => {
							const delta = deal.profit - deal.prevProfit;
							return (
								<div
									id={`deal-card-${deal.id}`}
									className={`deal-card ${i < 8 ? 'top' : ''} ${highlightedDealId === deal.id ? 'search-hit' : ''}`}
									key={deal.id}>
									<div>
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
											<strong style={{ color: '#7ccd9c' }}>
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
												background: '#101914',
												marginTop: 8,
												borderRadius: 8,
												padding: 8,
												fontSize: '.84rem',
											}}>
											<div>📦 {deal.packaging}</div>
											<div style={{ color: '#7ccd9c', marginTop: 3 }}>
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
															? '#7ccd9c'
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
									</div>
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

			{view === 'market-watch' && (
				<MarketWatchView lang={lang} tr={tr} onBackToMarket={() => setView('market')} />
			)}

			{view === 'assistant' && (
				<section className="section assistant-route">
					<div className="assistant-route-actions">
						<button
							type="button"
							className="btn btn-outline"
							style={{ marginBottom: 0 }}
							onClick={() => setView('market')}>
							<ArrowLeft size={16} aria-hidden /> {tr.assistantBack}
						</button>
						<div className="assistant-route-actions-group">
							<button
								type="button"
								className="btn-mini"
								aria-expanded={!assistantToolbarCollapsed}
								onClick={() => setAssistantToolbarCollapsed(v => !v)}>
								{assistantToolbarCollapsed ? (
									<>
										<ChevronDown size={14} aria-hidden /> {tr.assistantExpandTools}
									</>
								) : (
									<>
										<ChevronUp size={14} aria-hidden /> {tr.assistantCollapseTools}
									</>
								)}
							</button>
							<button type="button" className="btn btn-outline" onClick={() => setView('landing')}>
								<X size={16} aria-hidden /> {tr.assistantCloseChat}
							</button>
						</div>
					</div>
					<h2 style={{ margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
						<MessageSquare color="#7ccd9c" size={26} aria-hidden />
						{tr.assistantTitle}
					</h2>
					<p className="muted" style={{ margin: '0 0 8px', maxWidth: 720 }}>
						{tr.assistantSubtitle}
					</p>
					{chatHealth === 'offline' && (
						<div
							className="contact-panel"
							style={{
								marginBottom: 12,
								borderColor: 'rgba(248, 113, 113, 0.45)',
								background: 'rgba(127, 29, 29, 0.2)',
							}}>
							<p style={{ margin: 0, fontSize: '.88rem', lineHeight: 1.5 }}>
								{uiPickTwo(
									lang,
									isLikelyLocalDev
										? `Временен проблем при /api/chat. В нов таб отвори ${browserOrigin || 'http://localhost:5173'}/api/chat — очаква се JSON с "ok": true. Ако не върне, стартирай npm run dev (не само dev:vite) и опитай Ctrl+F5.`
										: `Няма връзка до /api/chat от ${browserOrigin || 'този сайт'}. В нов таб отвори ${browserOrigin}/api/chat — очаква се JSON с "ok": true и mistralConfigured (или друг LLM). На Vercel: домейнът да сочи същия проект, Environment Variables → Production → MISTRAL_API_KEY, после Redeploy; Logs → Functions при грешка.`,
									isLikelyLocalDev
										? `Temporary issue calling /api/chat. Open ${browserOrigin || 'http://localhost:5173'}/api/chat in a new tab — expect JSON with "ok": true. If not, run npm run dev (not dev:vite alone) and try Ctrl+F5.`
										: `Cannot reach /api/chat from ${browserOrigin || 'this origin'}. Open ${browserOrigin}/api/chat — expect JSON with "ok": true and mistralConfigured (or another LLM). On Vercel: point the domain at this project, set Production env MISTRAL_API_KEY (or OPENAI_API_KEY), Redeploy; check Functions logs on failure.`
								)}
							</p>
						</div>
					)}
					{chatHealth === 'no_key' && (
						<div
							className="contact-panel"
							style={{
								marginBottom: 12,
								borderColor: 'rgba(251, 191, 36, 0.45)',
								background: 'rgba(120, 53, 15, 0.25)',
							}}>
							<p style={{ margin: 0, fontSize: '.88rem', lineHeight: 1.5 }}>
								{uiPickTwo(
									lang,
									'Няма конфигуриран LLM за чат: добавете MISTRAL_API_KEY (EU облак), OPENAI_API_KEY или локален Ollama (OLLAMA_BASE_URL=http://127.0.0.1:11434 и OLLAMA_MODEL). Файл .env в корена; после рестарт на npm run dev. За Vercel задайте същите променливи в Environment Variables.',
									'No LLM for chat: set MISTRAL_API_KEY (EU cloud), OPENAI_API_KEY, or local Ollama (OLLAMA_BASE_URL=http://127.0.0.1:11434 and OLLAMA_MODEL) in project root .env, then restart npm run dev. On Vercel, set the same variables under Environment Variables.'
								)}
							</p>
						</div>
					)}
					<div className="contact-panel assistant-workbench">
						{!assistantToolbarCollapsed ? (
							<div className="assistant-panel-head">
								<div className="chat-actions" style={{ marginBottom: 8 }}>
									<span className="muted" style={{ fontSize: '.8rem' }}>
										{tr.chatPromptsLabel}
									</span>
									<button type="button" className="btn-mini" onClick={() => setChatMessages([])}>
										{tr.chatClear}
									</button>
								</div>
								<p className="assistant-prompts-scroll-hint">{tr.chatPromptsScrollHint}</p>
								<div
									className="deal-actions assistant-quick-prompts-scroll"
									style={{ marginBottom: 10 }}
									role="region"
									aria-label={tr.chatPromptsLabel}>
									{ASSISTANT_QUICK_PROMPTS.map(item => (
										<button
											key={item.id}
											type="button"
											className="deal-chip-btn"
											disabled={chatLoading}
											onClick={() => runQuickPrompt(item)}>
											{quickPromptLabel(item, lang)}
										</button>
									))}
								</div>
								{assistantNotice && (
									<p
										className="muted"
										style={{
											margin: '0 0 10px',
											fontSize: '.82rem',
											color: '#99f6e4',
											lineHeight: 1.45,
										}}>
										{assistantNotice}
									</p>
								)}
							</div>
						) : null}
						{mediaAiUnlocked && (
							<div className="assistant-doc-toolbar">
								<input
									ref={docImageInputRef}
									type="file"
									hidden
									accept="image/jpeg,image/png,image/webp,image/gif"
									onChange={onDocImageChange}
								/>
								<button
									type="button"
									className="btn btn-outline"
									style={{ fontSize: '.82rem', padding: '8px 12px' }}
									disabled={docExplainLoading || chatLoading}
									onClick={() => docImageInputRef.current?.click()}>
									<FileImage size={16} aria-hidden style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
									{docExplainLoading ? (
										<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
											<Loader2 size={14} className="spin" aria-hidden />
											…
										</span>
									) : (
										tr.chatExplainDoc
									)}
								</button>
							</div>
						)}
						{assistantToolbarCollapsed && assistantNotice ? (
							<p
								className="muted"
								style={{
									margin: '0 0 10px',
									fontSize: '.82rem',
									color: '#99f6e4',
									lineHeight: 1.45,
								}}>
								{assistantNotice}
							</p>
						) : null}
						<div className="assistant-msgs" aria-live="polite">
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
						<div className="assistant-panel-foot">
							<div className="assistant-input-row">
								<textarea
									ref={chatTextareaRef}
									placeholder={tr.chatPlaceholder}
									value={chatInput}
									enterKeyHint="send"
									inputMode="text"
									onChange={e => setChatInput(e.target.value)}
									onFocus={() => {
										scheduleViewportResyncForKeyboard();
										const scrollDelay =
											typeof document !== 'undefined' &&
											document.documentElement.classList.contains('ios')
												? 450
												: 280;
										window.requestAnimationFrame(() => {
											setTimeout(() => {
												chatTextareaRef.current?.scrollIntoView({
													block: 'nearest',
													behavior: document.documentElement.classList.contains('ios')
														? 'auto'
														: 'smooth',
												});
												scheduleViewportResyncForKeyboard();
											}, scrollDelay);
										});
									}}
									onKeyDown={e => {
										if (e.key === 'Enter' && !e.shiftKey) {
											e.preventDefault();
											void sendChat();
										}
									}}
								/>
								{mediaAiUnlocked && (
									<button
										type="button"
										className={`assistant-icon-btn${voiceListening ? ' listening' : ''}`}
										disabled={chatLoading || docExplainLoading}
										onClick={() => toggleVoiceInput()}
										aria-pressed={voiceListening}
										title={voiceListening ? tr.chatMicStopAria : tr.chatMicAria}
										aria-label={voiceListening ? tr.chatMicStopAria : tr.chatMicAria}>
										<Mic size={20} aria-hidden />
									</button>
								)}
								<button
									type="button"
									className="btn btn-primary"
									disabled={chatLoading}
									onClick={() => void sendChat()}>
									<Send size={18} aria-hidden />
								</button>
							</div>
							<p className="muted" style={{ margin: '12px 0 0', fontSize: '.78rem', lineHeight: 1.45 }}>
								{tr.assistantLegalFooter}
							</p>
						</div>
					</div>
				</section>
			)}

			{view === 'watchlist' && (
				<OperationsHubView
					tr={tr}
					lang={lang}
					watchedDeals={watchedDeals}
					alertsEnabledIds={alertsEnabledIds}
					toggleWatchlist={toggleWatchlist}
					toggleAlert={toggleAlert}
					onNavigate={v => setView(v as View)}
					MVP_MODE={MVP_MODE}
					lastSavedDeal={lastSavedDeal}
					lastAlertDeal={lastAlertDeal}
				/>
			)}

			{view === 'register' && (
				<section className="section">
					<h2>{tr.registerTitle}</h2>
					<p className="muted">{tr.registerSubtitle}</p>
					<div className="form-grid">
						<input
							type="email"
							autoComplete="email"
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
							placeholder={tr.fullNamePh}
							value={regFullName}
							onChange={e => setRegFullName(e.target.value)}
							autoComplete="name"
						/>
						{supabaseRegisterEnabled ? (
							<>
								<input
									placeholder={tr.passwordPh}
									type="password"
									autoComplete="new-password"
									value={regPassword}
									onChange={e => setRegPassword(e.target.value)}
								/>
								<p
									className="muted"
									style={{
										gridColumn: '1 / -1',
										margin: '-6px 0 0',
										fontSize: '.82rem',
									}}>
									{tr.registerPasswordCloudHint}
								</p>
								{showRegisterPasswordError ? (
									<p
										style={{
											gridColumn: '1 / -1',
											margin: '-6px 0 0',
											color: '#f87171',
											fontSize: '.84rem',
										}}>
										{tr.registerPasswordTooShort}
									</p>
								) : null}
							</>
						) : null}
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
						<input
							type="email"
							autoComplete="email"
							placeholder={tr.loginEmailPh}
							value={loginEmail}
							onChange={e => {
								setLoginEmail(e.target.value);
								if (loginMsg) setLoginMsg('');
							}}
						/>
						{loginEmail.trim().length > 0 && !isValidEmail(loginEmail) ? (
							<p
								style={{
									gridColumn: '1 / -1',
									margin: '-6px 0 0',
									color: '#f87171',
									fontSize: '.84rem',
								}}>
								{invalidEmailText}
							</p>
						) : null}
						<input
							type="password"
							autoComplete="current-password"
							placeholder={tr.loginPasswordPh}
							value={loginPassword}
							onChange={e => {
								setLoginPassword(e.target.value);
								if (loginMsg) setLoginMsg('');
							}}
						/>
						<p
							className="muted"
							style={{
								gridColumn: '1 / -1',
								margin: '-6px 0 0',
								fontSize: '.82rem',
							}}>
							{tr.loginPasswordDemoHint}
						</p>
					</div>
					<div
						style={{
							marginTop: 12,
							display: 'flex',
							gap: 8,
							flexWrap: 'wrap',
							alignItems: 'center',
						}}>
						<button type="button" className="btn btn-primary" onClick={handleDemoSignIn}>
							{tr.loginContinueDemo}
						</button>
						<button type="button" className="btn btn-outline" onClick={() => setView('register')}>
							{tr.loginNoAccount}
						</button>
						{loginMsg ? (
							<span className="muted" style={{ width: '100%', fontSize: '.9rem' }}>
								{loginMsg}
							</span>
						) : null}
					</div>
					<CloudAuthPanel tr={tr} />
				</section>
			)}

			{view === 'command' && <FarmerCommandCenter lang={lang} tr={tr} />}

			{view === 'subsidy-calculator' && (
				<SubsidyCalculatorView
					lang={lang}
					tr={tr}
					onOpenCalendar={() => setView('season-calendar')}
					initialFocus={subsidyPrefillFocus}
					initialMarketQuery={subsidyPrefillQuery}
					onOpenMarketWithQuery={(query) => {
						setSearchQuery(query);
						setSelectedCategory('all');
						setView('market');
					}}
				/>
			)}

			{view === 'season-calendar' && (
				<SeasonCalendarView
					lang={lang}
					tr={tr}
					onOpenSubsidy={() => setView('subsidy-calculator')}
				/>
			)}

			{view === 'field-watch' && (
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
						<h2 style={{ margin: 0 }}>{lang === 'bg' ? 'Field Watch карта' : 'Field Watch Map'}</h2>
						<a
							className="btn btn-outline"
							href={`/agrinexus-field-watch.html?oblast=${encodeURIComponent(selectedFieldCityId)}&lang=${lang}`}
							target="_blank"
							rel="noreferrer">
							{lang === 'bg' ? 'Отвори в нов таб' : 'Open in new tab'}
						</a>
					</div>
					<p className="muted" style={{ marginTop: 0, marginBottom: 12 }}>
						{lang === 'bg'
							? 'Интерактивна карта за полеви мониторинг с timelapse, Sentinel/NASA слоеве и NDVI режим.'
							: 'Interactive field monitoring map with timelapse, Sentinel/NASA layers, and NDVI mode.'}
					</p>
					<div
						className="contact-panel"
						style={{ marginBottom: 12, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
						<label style={{ fontSize: '.88rem' }}>
							{lang === 'bg' ? 'Областен град' : 'Oblast city'}
						</label>
						<select
							value={selectedFieldCityId}
							onChange={(event) => setSelectedFieldCityId(event.target.value)}
							style={{ minWidth: 220 }}>
							{FIELD_WATCH_OBLAST_CITIES.map((city) => (
								<option key={city.id} value={city.id}>
									{lang === 'bg' ? city.bg : city.en}
								</option>
							))}
						</select>
						<button
							type="button"
							className="btn btn-outline"
							onClick={() => {
								const cityLabel = lang === 'bg' ? selectedFieldCity.bg : selectedFieldCity.en;
								const prompt =
									lang === 'bg'
										? `Дай агро прогноза с RAG за област ${cityLabel}: риск от суша, препоръчани култури, и 3 практически действия за следващите 30 дни.`
										: `Give me a RAG-backed agri forecast for ${cityLabel} oblast: drought risk, recommended crops, and 3 practical actions for the next 30 days.`;
								setChatInput(prompt);
								setPendingAutoChatPrompt(prompt);
								setView('assistant');
							}}>
							{lang === 'bg' ? 'Попитай AI за областта' : 'Ask AI for this oblast'}
						</button>
					</div>
					<div
						style={{
							border: '1px solid var(--line)',
							borderRadius: 14,
							overflow: 'hidden',
							background: '#0b1120',
							minHeight: 'min(760px, 74vh)',
						}}>
						<iframe
							title="AgriNexus Field Watch"
							src={`/agrinexus-field-watch.html?oblast=${encodeURIComponent(selectedFieldCityId)}&lang=${lang}`}
							style={{ width: '100%', height: 'min(78vh, 760px)', minHeight: 520, border: 0 }}
						/>
					</div>
				</section>
			)}

			{view === 'trade-documents' && <TradeDocumentsBulgariaView lang={lang} tr={tr} />}

			{view === 'crop-statistics' && (
				<CropStatisticsBulgariaView
					lang={lang}
					tr={tr}
					onOpenFoodSecurity={() => setView('food-security')}
				/>
			)}
			{view === 'food-security' && <FoodSecurityBreakEvenView lang={lang} tr={tr} />}

			{view === 'file-upload' && (
				<section className="section">
					<div
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: 12,
							flexWrap: 'wrap',
							marginBottom: 16,
						}}>
						<button type="button" className="btn btn-outline" onClick={() => setView('landing')}>
							<ArrowLeft size={16} aria-hidden /> {tr.fileUploadPageBack}
						</button>
					</div>
					<h2 style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
						<FileUp size={26} color="#7ccd9c" aria-hidden /> {tr.fileUploadPageTitle}
					</h2>
					<p className="muted" style={{ marginTop: 10, maxWidth: 640, lineHeight: 1.5 }}>
						{tr.fileUploadPageHint}
					</p>
					<FileUploadPanel senderEmail={contactEmail} lang={lang} />
				</section>
			)}

			{view === 'privacy' && (
				<section className="section legal-section">
					<h2>{tr.privacyTitle}</h2>
					<div className="contact-panel legal-panel">
						<p className="muted">{tr.privacyP1}</p>
						<p className="muted">{tr.privacyP2}</p>
						<p className="muted">{tr.privacyP3}</p>
						<p className="muted">{tr.privacyP4}</p>
						<div style={{ marginTop: 12 }}>
							<button
								type="button"
								className="btn btn-outline"
								onClick={() => {
									safeLocalRemove(COOKIE_CONSENT_KEY);
									safeSessionRemove('agrinexus-visit-tracked');
									setCookieConsent(null);
								}}>
								{tr.cookieConsentManage}
							</button>
						</div>
					</div>
					<button type="button" className="btn btn-outline" onClick={() => setView('landing')}>
						{tr.privacyBackHome}
					</button>
				</section>
			)}

			{view === 'terms' && (
				<section className="section legal-section">
					<h2>{tr.termsTitle}</h2>
					<div className="contact-panel legal-panel">
						<p className="muted">{tr.termsP1}</p>
						<p className="muted">{tr.termsP2}</p>
						<p className="muted">{tr.termsP3}</p>
					</div>
					<button type="button" className="btn btn-outline" onClick={() => setView('landing')}>
						{tr.termsBackHome}
					</button>
				</section>
			)}

			{view === 'company' && (
				<section className="section">
					<h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
						<Building2 size={22} color="#7ccd9c" /> {tr.companyTitle}
					</h2>
					<p className="muted">{tr.companySubtitle}</p>
					<div className="contact-panel">
						<p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
							<Globe2 size={16} color="#7ccd9c" /> {tr.companyRegions}
						</p>
						<p
							style={{
								margin: '8px 0 0',
								display: 'flex',
								alignItems: 'center',
								gap: 8,
							}}>
							<Mail size={16} color="#7ccd9c" /> info@agrinexus.eu
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

			<footer className="site-footer">
				<div className="site-footer-inner">
					<p className="site-footer-copy muted">
						© {new Date().getFullYear()} AgriNexus — {tr.footerRightsTagline}
					</p>
					<div className="site-footer-links">
						<a className="footer-link-btn" href="mailto:info@agrinexus.eu">
							info@agrinexus.eu
						</a>
						<span className="site-footer-sep" aria-hidden>
							·
						</span>
						<button type="button" className="footer-link-btn" onClick={() => setView('privacy')}>
							{tr.footerPrivacy}
						</button>
						<span className="site-footer-sep" aria-hidden>
							·
						</span>
						<button type="button" className="footer-link-btn" onClick={() => setView('terms')}>
							{tr.footerTerms}
						</button>
					</div>
				</div>
			</footer>

			{cookieConsent === null && (
				<div
					className="contact-panel"
					style={{
						position: 'fixed',
						left: 16,
						right: 16,
						bottom: isMobileViewport ? 84 : 16,
						zIndex: 1200,
						margin: 0,
						borderColor: 'rgba(124, 205, 156, 0.35)',
						background: 'rgba(8, 16, 12, 0.94)',
						backdropFilter: 'blur(8px)',
					}}>
					<p className="muted" style={{ margin: '0 0 10px', fontSize: '.88rem', lineHeight: 1.5 }}>
						{tr.cookieConsentText}
					</p>
					<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
						<button
							type="button"
							className="btn btn-outline"
							onClick={() => setCookieConsent('rejected')}>
							{tr.cookieConsentReject}
						</button>
						<button
							type="button"
							className="btn btn-primary"
							onClick={() => setCookieConsent('accepted')}>
							{tr.cookieConsentAccept}
						</button>
					</div>
				</div>
			)}

			{isMobileViewport && (
				<div className="mobile-nav" role="navigation" aria-label={tr.mobileNavAria}>
					<div className="mobile-nav-row">
						<button
							type="button"
							className={`mobile-nav-btn ${view === 'landing' ? 'active' : ''}`}
							onClick={() => {
								setView('landing');
								setMobileNavExpand(null);
							}}
							aria-label={tr.navHome}>
							<Leaf size={16} />
							<MobileNavLabel text={tr.navHome} />
						</button>
						<button
							type="button"
							className={`mobile-nav-btn ${TRADING_VIEWS.has(view) ? 'active' : ''}`}
							aria-expanded={mobileNavExpand === 'markets'}
							aria-label={tr.navGroupMarkets}
							onClick={() =>
								setMobileNavExpand(prev => (prev === 'markets' ? null : 'markets'))
							}>
							<ChevronDown size={16} aria-hidden />
							<MobileNavLabel text={tr.navGroupMarketsShort} hint={tr.navGroupMarkets} />
						</button>
						<button
							type="button"
							className={`mobile-nav-btn ${view === 'assistant' ? 'active' : ''}`}
							onClick={() => setView('assistant')}
							aria-label={tr.navAssistant}>
							<MessageSquare size={16} aria-hidden />
							<MobileNavLabel text={tr.mobileAssistantTab} hint={tr.navAssistant} />
						</button>
						{MVP_MODE ? (
							<>
								<button
									type="button"
									className={`mobile-nav-btn ${view === 'register' ? 'active' : ''}`}
									onClick={() => setView('register')}
									aria-label={tr.navGetStarted}>
									<UserPlus size={16} aria-hidden />
									<MobileNavLabel text={tr.navGetStarted} />
								</button>
								<button
									type="button"
									className={`mobile-nav-btn ${view === 'login' ? 'active' : ''}`}
									onClick={() => setView('login')}
									aria-label={tr.navLogin}>
									<LogIn size={16} aria-hidden />
									<MobileNavLabel text={tr.navLogin} />
								</button>
							</>
						) : (
							<>
								<button
									type="button"
									className={`mobile-nav-btn ${view === 'clients' ? 'active' : ''}`}
									onClick={() => setView('clients')}
									aria-label={tr.navClients}>
									<Users size={16} aria-hidden />
									<MobileNavLabel text={tr.navClients} />
								</button>
								<button
									type="button"
									className={`mobile-nav-btn ${view === 'watchlist' ? 'active' : ''}`}
									onClick={() => setView('watchlist')}
									aria-label={tr.navWatchlist}>
									<Bookmark size={16} aria-hidden />
									<MobileNavLabel text={tr.navWatchlist} />
								</button>
							</>
						)}
					</div>
					{mobileNavExpand === 'markets' && (
						<div className="mobile-nav-subrow cols-2">
							<button
								type="button"
								className={`mobile-nav-btn ${view === 'market' ? 'active' : ''}`}
								aria-label={tr.navMarket}
								onClick={() => {
									setView('market');
									setMobileNavExpand(null);
								}}>
								<Search size={16} aria-hidden />
								<MobileNavLabel text={tr.navMarketShort} hint={tr.navMarket} />
							</button>
							<button
								type="button"
								className={`mobile-nav-btn ${view === 'market-watch' ? 'active' : ''}`}
								aria-label={tr.navMarketWatch}
								onClick={() => {
									setView('market-watch');
									setMobileNavExpand(null);
								}}>
								<LineChart size={16} aria-hidden />
								<MobileNavLabel text={tr.navMarketWatchShort} hint={tr.navMarketWatch} />
							</button>
							<button
								type="button"
								className={`mobile-nav-btn ${view === 'crop-statistics' ? 'active' : ''}`}
								aria-label={tr.navCropStatistics}
								onClick={() => {
									setView('crop-statistics');
									setMobileNavExpand(null);
								}}>
								<BarChart3 size={16} aria-hidden />
								<MobileNavLabel text={tr.navCropStatisticsShort} hint={tr.navCropStatistics} />
							</button>
							<button
								type="button"
								className={`mobile-nav-btn ${view === 'trade-documents' ? 'active' : ''}`}
								aria-label={tr.navTradeDocuments}
								onClick={() => {
									setView('trade-documents');
									setMobileNavExpand(null);
								}}>
								<FileText size={16} aria-hidden />
								<MobileNavLabel text={tr.navTradeDocumentsShort} hint={tr.navTradeDocuments} />
							</button>
						</div>
					)}
					<div className="mobile-nav-row tools">
						<button
							type="button"
							className={`mobile-nav-btn ${FARM_VIEWS.has(view) ? 'active' : ''}`}
							aria-expanded={mobileNavExpand === 'farm'}
							aria-label={tr.navGroupFarm}
							onClick={() =>
								setMobileNavExpand(prev => (prev === 'farm' ? null : 'farm'))
							}>
							<ChevronDown size={16} aria-hidden />
							<MobileNavLabel text={tr.navGroupFarmShort} hint={tr.navGroupFarm} />
						</button>
						<button
							type="button"
							className={`mobile-nav-btn ${LOGISTICS_VIEWS.has(view) ? 'active' : ''}`}
							aria-expanded={mobileNavExpand === 'logistics'}
							aria-label={tr.navLogistics}
							onClick={() =>
								setMobileNavExpand(prev => (prev === 'logistics' ? null : 'logistics'))
							}>
							<ChevronDown size={16} aria-hidden />
							<MobileNavLabel text={tr.navLogisticsShort} hint={tr.navLogistics} />
						</button>
					</div>
					{mobileNavExpand === 'farm' && (
						<div className="mobile-nav-subrow">
							<button
								type="button"
								className={`mobile-nav-btn ${view === 'command' ? 'active' : ''}`}
								aria-label={tr.navCommand}
								onClick={() => {
									setView('command');
									setMobileNavExpand(null);
								}}>
								<ClipboardList size={16} aria-hidden />
								<MobileNavLabel text={tr.navCommandShort} hint={tr.navCommand} />
							</button>
							<button
								type="button"
								className={`mobile-nav-btn ${view === 'subsidy-calculator' ? 'active' : ''}`}
								aria-label={tr.navSubsidyCalculator}
								onClick={() => {
									setView('subsidy-calculator');
									setMobileNavExpand(null);
								}}>
								<Calculator size={16} aria-hidden />
								<MobileNavLabel text={tr.navSubsidyCalculatorShort} hint={tr.navSubsidyCalculator} />
							</button>
							<button
								type="button"
								className={`mobile-nav-btn ${view === 'season-calendar' ? 'active' : ''}`}
								aria-label={tr.navSeasonCalendar}
								onClick={() => {
									setView('season-calendar');
									setMobileNavExpand(null);
								}}>
								<CalendarDays size={16} aria-hidden />
								<MobileNavLabel text={tr.navSeasonCalendarShort} hint={tr.navSeasonCalendar} />
							</button>
						</div>
					)}
					{mobileNavExpand === 'logistics' && (
						<div className="mobile-nav-subrow cols-2">
							<button
								type="button"
								className={`mobile-nav-btn ${view === 'food-security' ? 'active' : ''}`}
								aria-label={tr.navFoodSecurity}
								onClick={() => {
									setView('food-security');
									setMobileNavExpand(null);
								}}>
								<Shield size={16} aria-hidden />
								<MobileNavLabel text={tr.navFoodSecurityShort} hint={tr.navFoodSecurity} />
							</button>
							<button
								type="button"
								className={`mobile-nav-btn ${view === 'file-upload' ? 'active' : ''}`}
								aria-label={tr.portalLogisticsSubFileUpload}
								onClick={() => {
									setView('file-upload');
									setMobileNavExpand(null);
								}}>
								<FileUp size={16} aria-hidden />
								<MobileNavLabel
									text={tr.navFileUploadShort}
									hint={tr.portalLogisticsSubFileUpload}
								/>
							</button>
						</div>
					)}
				</div>
			)}
		</div>
	);
}


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
	CloudRain,
	FileImage,
	FileText,
	FileUp,
	Globe2,
	Leaf,
	Loader2,
	LogIn,
	Mail,
	MessageSquare,
	Mic,
	Send,
	Shield,
	Sprout,
	UserPlus,
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
import { FieldWatchLeaflet } from './components/FieldWatchLeaflet';
import { WeatherFarmView } from './components/WeatherFarmView';
import {
	cycleUiLang,
	getUiStrings,
	parseStoredLang,
	speechRecognitionLang,
	uiLangShortLabel,
	type UiLang,
} from './lib/i18n';
import { recordBrowserVisitOncePerSession } from './lib/track-browser-visit';
import type { ChatPersona } from './lib/chat-persona';
import {
	ASSISTANT_QUICK_PROMPTS,
	type AssistantQuickPromptItem,
	quickPromptLabel,
} from './lib/assistant-quick-actions';
import { buildFarmerContextForAi } from './lib/build-farmer-context-for-ai';
import type { FarmProductionFocus } from './lib/subsidy-calculator';
import { FIELD_WATCH_OBLAST_PRESETS } from './lib/field-watch-oblast-presets';
import {
	isValidOblastAnchorId,
	OBLAST_ANCHOR_STORAGE_KEY,
	readStoredOblastAnchorId,
	writeStoredOblastAnchorId,
} from './lib/oblast-anchor-storage';
import { getSupabaseBrowserClient } from './lib/infra/supabase-browser';
import { useSupabaseSession } from './hooks/use-supabase-session';
import { LEAD_FORM_HP_FIELD } from './lib/form-bot-guard';

function uiPickTwo(lang: UiLang, bg: string, en: string): string {
	return lang === 'bg' ? bg : en;
}

/** When `VITE_MVP_MODE=1` in `.env`, hides Operations hub tab — core funnel only. Omit or leave unset for full navigation. */
const MVP_MODE = import.meta.env.VITE_MVP_MODE === '1';

/** Dev: Node `/api/chat` uses `DEV_API_PORT` in `.env`; Vite exposes `VITE_DEV_API_PORT` for UI hints. */
const COOKIE_CONSENT_KEY = 'agrinexus-cookie-consent';
/** Set after successful interest signup when the user accepted non-essential cookies (prefill email on return). */
const REGISTER_ACCOUNT_COOKIE = 'agrinexus_register_email';
const REGISTER_ACCOUNT_LOCAL_KEY = 'agrinexus-register-email-saved';
/** Same-tab session prefill when long-term cookie/localStorage is not used (no consent or rejected). */
const REGISTER_ACCOUNT_SESSION_KEY = 'agrinexus-register-email-session';
type CookieConsent = 'accepted' | 'rejected';

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

function getBrowserCookie(name: string): string | null {
	if (typeof document === 'undefined') return null;
	try {
		const segment = `; ${document.cookie}`.split(`; ${name}=`);
		if (segment.length < 2) return null;
		const raw = segment.pop()?.split(';').shift();
		return raw ? decodeURIComponent(raw) : null;
	} catch {
		return null;
	}
}

function setBrowserCookie(name: string, value: string, maxAgeSec: number): void {
	if (typeof document === 'undefined') return;
	try {
		const secure =
			typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
		document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax${secure}`;
	} catch {
		/* ignore */
	}
}

function readRegisterAccountHint(): string | null {
	const fromCookie = getBrowserCookie(REGISTER_ACCOUNT_COOKIE)?.trim();
	if (fromCookie) return fromCookie;
	const fromLocal = safeLocalGet(REGISTER_ACCOUNT_LOCAL_KEY)?.trim();
	if (fromLocal) return fromLocal;
	return safeSessionGet(REGISTER_ACCOUNT_SESSION_KEY)?.trim() || null;
}

function persistRegisterAccountHint(
	emailTrim: string,
	cookieConsent: CookieConsent | null
): void {
	if (!emailTrim) return;
	if (cookieConsent === 'accepted') {
		safeSessionRemove(REGISTER_ACCOUNT_SESSION_KEY);
		const maxAge = 180 * 24 * 60 * 60;
		setBrowserCookie(REGISTER_ACCOUNT_COOKIE, emailTrim, maxAge);
		safeLocalSet(REGISTER_ACCOUNT_LOCAL_KEY, emailTrim);
	} else {
		safeSessionSet(REGISTER_ACCOUNT_SESSION_KEY, emailTrim);
	}
}

function clearRegisterAccountHint(): void {
	safeLocalRemove(REGISTER_ACCOUNT_LOCAL_KEY);
	safeSessionRemove(REGISTER_ACCOUNT_SESSION_KEY);
	setBrowserCookie(REGISTER_ACCOUNT_COOKIE, '', 0);
}

type ChatTurn = { role: 'user' | 'assistant'; content: string };

type SendChatOpts = { text?: string; persona?: ChatPersona; ragPromptId?: string | null };

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

type View =
	| 'landing'
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
	| 'field-watch'
	| 'weather';

/** Crop statistics + trade docs ? legacy nav group label ?Markets?. */
const TRADING_VIEWS = new Set<View>(['crop-statistics', 'trade-documents', 'weather']);
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
		role: 'Директор „Снабдяване“',
		region: 'Египет (Кайро / Александрия)',
		focus: 'Доматени продукти, слънчогледово олио',
		monthlyVolume: '420 тона',
		notes:
			'Силно търсене преди Рамазан. Предпочита стабилни месечни ценови прозорци.',
	},
	'c-102': {
		role: 'Категориен мениджър',
		region: 'Саудитска Арабия (Рияд / Джеда)',
		focus: 'Доматено пюре в сашета, бобови култури',
		monthlyVolume: '290 тона',
		notes:
			'Изисква бърза валидация на сертификати и строг график на пратките.',
	},
	'c-103': {
		role: 'Ръководител „Внос“',
		region: 'Германия / Нидерландия',
		focus: 'Премиум пшеница, ечемик',
		monthlyVolume: '680 тона',
		notes:
			'Чувствителност към марж. Предпочита разделени договори със седмичен преглед на цените.',
	},
};

async function apiChat(
	messages: ChatTurn[],
	dealContext: string,
	locale: UiLang,
	signal: AbortSignal | undefined,
	persona: ChatPersona,
	farmerContext: string,
	ragPromptId?: string | null,
): Promise<string> {
	const normalizeAssistantReply = (raw: string): string => {
		const stripFallbackMeta = (text: string): string => {
			return text
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

	/** Mistral + long system prompt + JSON mode can exceed ~15s; Vercel api/chat max 60s. */
	const timeoutMs = 60000;
	const maxAttempts = 2;
	const requestBody = JSON.stringify({
		messages,
		dealContext,
		locale,
		persona,
		farmerContext,
		...(ragPromptId ? { ragPromptId } : {}),
	});

	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		const timeoutController = new AbortController();
		const requestController = new AbortController();
		let timeoutFired = false;
		const abortRequest = () => requestController.abort();
		signal?.addEventListener('abort', abortRequest);
		const timeoutId = setTimeout(() => {
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
							? `Хостът върна страница вместо JSON (HTTP ${res.status}). Отворете /api/chat в нов раздел и очаквайте JSON с llmConfigured / mistralConfigured. На Vercel задайте MISTRAL_API_KEY или OPENAI_API_KEY за Production, уверете се че deployment включва папката api/ и домейнът сочи към този проект; проверете Logs при Functions.`
							: `Host returned a page instead of JSON (HTTP ${res.status}). Open /api/chat in a new tab and expect JSON with llmConfigured / mistralConfigured. On Vercel set MISTRAL_API_KEY or OPENAI_API_KEY for Production, ensure this deployment includes the api/ folder and the domain targets this project; check Functions logs.`
					);
				}
				try {
					data = JSON.parse(trimmed) as typeof data;
				} catch {
					throw new Error(
						locale === 'bg'
							? `Сървърът не върна валиден JSON (HTTP ${res.status}). Проверете дали /api/chat е deploy-нат (папка api/) и логовете на Vercel function.`
							: `Server did not return valid JSON (HTTP ${res.status}). Verify /api/chat is deployed and check Vercel function logs.`
					);
				}
			}
			if (!res.ok) {
				throw new Error(
					data.error ||
						data.hint ||
						(locale === 'bg' ? 'Заявката за чат не бе успешна' : 'Chat request failed')
				);
			}
			if (!data.reply) {
				throw new Error(locale === 'bg' ? 'Празен отговор от AI' : 'Empty AI response');
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
							? 'Заявката за чат изтече. Проверете връзката и опитайте отново.'
							: 'Chat request timed out. Check your connection and try again.'
					);
				}
				throw err;
			}
			await new Promise(resolve => setTimeout(resolve, 450));
		} finally {
			clearTimeout(timeoutId);
			signal?.removeEventListener('abort', abortRequest);
			timeoutController.abort();
		}
	}

	throw new Error(locale === 'bg' ? 'Заявката за чат не бе успешна' : 'Chat request failed');
}

/** Coalesce rapid visualViewport events into one rAF to reduce bottom-bar jitter on mobile. */
let visualViewportFlushId = 0;

function flushVisualViewportInsets(): void {
	visualViewportFlushId = 0;
	const vv = typeof window !== 'undefined' ? window.visualViewport : null;
	if (!vv) return;
	const cover = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
	document.documentElement.style.setProperty('--keyboard-cover', `${cover}px`);
	document.documentElement.style.setProperty('--vv-height', `${vv.height}px`);
	document.body.toggleAttribute('data-vk-open', cover > 56);
}

/**
 * Map `visualViewport` to CSS vars for the software keyboard (Chrome Android, iPhone Safari, etc.).
 */
function syncVisualViewportInsets(): void {
	if (typeof window === 'undefined') return;
	if (visualViewportFlushId) cancelAnimationFrame(visualViewportFlushId);
	visualViewportFlushId = requestAnimationFrame(flushVisualViewportInsets);
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

/** Compact mobile nav caption (no `title` tooltips — long‑press on phones showed “AI помощник” and felt like a nagging “help” popup). */
function MobileNavLabel({ text, hint: _hint }: { text: string; hint?: string }) {
	return <span className="mobile-nav-label">{text}</span>;
}

export default function App() {
	const { user: supabaseUser } = useSupabaseSession();
	const [view, setView] = useState<View>('landing');
	const [navMenuOpen, setNavMenuOpen] = useState<'markets' | 'farm' | 'logistics' | null>(null);
	const [mobileNavExpand, setMobileNavExpand] = useState<'markets' | 'farm' | 'logistics' | null>(
		null
	);
	const mobileNavExpandRef = useRef(mobileNavExpand);
	mobileNavExpandRef.current = mobileNavExpand;
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
			if (visualViewportFlushId) cancelAnimationFrame(visualViewportFlushId);
			visualViewportFlushId = 0;
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

	/** Fieldlot (и др.) лендинги: `/?from=fieldlot` → регистрация; `&mode=login` → вход. Почиства query от адресната лента. */
	useEffect(() => {
		if (typeof window === 'undefined') return;
		const u = new URL(window.location.href);
		const from = u.searchParams.get('from')?.trim().toLowerCase();
		if (from !== 'fieldlot') return;
		const mode = u.searchParams.get('mode')?.trim().toLowerCase();
		setView(mode === 'login' ? 'login' : 'register');
		u.searchParams.delete('from');
		u.searchParams.delete('mode');
		const q = u.searchParams.toString();
		const next = u.pathname + (q ? `?${q}` : '') + u.hash;
		window.history.replaceState(null, '', next);
	}, []);

	const [lang, setLang] = useState<UiLang>(() => parseStoredLang(safeLocalGet('agrinexus-lang')));
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

	const [subsidyPrefillFocus, _setSubsidyPrefillFocus] = useState<FarmProductionFocus | null>(null);
	const [selectedClientId, setSelectedClientId] = useState(CLIENT_PROFILES[0].id);
	const [isMobileViewport, setIsMobileViewport] = useState(() =>
		typeof window !== 'undefined' ? window.matchMedia('(max-width: 900px)').matches : false
	);

	const [chatMessages, setChatMessages] = useState<ChatTurn[]>([]);
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
	const [assistantNotice, setAssistantNotice] = useState<string | null>(null);
	const [assistantToolbarCollapsed, setAssistantToolbarCollapsed] = useState(() =>
		typeof window !== 'undefined' ? window.matchMedia('(max-width: 768px)').matches : false,
	);
	const [selectedFieldCityId, setSelectedFieldCityId] = useState<string>(() => {
		if (typeof window === 'undefined') return 'dobrich';
		return readStoredOblastAnchorId() ?? 'dobrich';
	});
	const [fieldWatchRecenterNonce, setFieldWatchRecenterNonce] = useState(0);
	const selectedFieldCity =
		FIELD_WATCH_OBLAST_PRESETS.find((city) => city.id === selectedFieldCityId) ??
		FIELD_WATCH_OBLAST_PRESETS[0];
	const speechRef = useRef<SpeechRecognitionInstance | null>(null);
	const registerEmailHintHydratedRef = useRef(false);
	const registerFormOpenedAtRef = useRef(Date.now());

	const demoSessionEmail = useMemo(() => {
		void sessionTick;
		const e = safeLocalGet('agrinexus-demo-email');
		return e?.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()) ? e.trim() : null;
	}, [sessionTick]);
	const cloudAccountEmail = useMemo(() => {
		const e = supabaseUser?.email?.trim() ?? '';
		return e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
	}, [supabaseUser?.email]);
	/** Email identity for unlocking mic when LLM health is idle (demo localStorage or Supabase session). */
	const identityEmailForAi = demoSessionEmail ?? cloudAccountEmail;
	const [chatHealth, setChatHealth] = useState<'idle' | 'ready' | 'no_key' | 'offline'>('idle');
	/** Mic unlock policy: LLM ready on server or signed-in/demo identity (see toggleVoiceInput). */
	const mediaAiUnlocked = useMemo(
		() => chatHealth === 'ready' || Boolean(identityEmailForAi),
		[chatHealth, identityEmailForAi],
	);

	const [regEmail, setRegEmail] = useState('');
	const [regHp, setRegHp] = useState('');
	const [regStatus, setRegStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle');
	const [regMsg, setRegMsg] = useState('');

	const [loginEmail, setLoginEmail] = useState('');
	const [loginPassword, setLoginPassword] = useState('');
	const [loginMsg, setLoginMsg] = useState('');

	const [leadFormAntiBotReady, setLeadFormAntiBotReady] = useState(false);
	const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
	const supabaseRegisterEnabled = useMemo(() => getSupabaseBrowserClient() !== null, []);
	const canSubmitRegister = isValidEmail(regEmail) && leadFormAntiBotReady;
	const showRegisterEmailError = regEmail.trim().length > 0 && !isValidEmail(regEmail);
	const invalidEmailText =
		lang === 'bg'
			? 'Моля, въведете валиден имейл адрес.'
			: 'Please enter a valid email address.';

	useEffect(() => {
		if (view !== 'register') {
			registerEmailHintHydratedRef.current = false;
			return;
		}
		registerFormOpenedAtRef.current = Date.now();
		if (registerEmailHintHydratedRef.current) return;
		registerEmailHintHydratedRef.current = true;
		const hint = readRegisterAccountHint();
		if (hint && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(hint)) {
			setRegEmail((prev) => (prev.trim().length > 0 ? prev : hint.trim()));
		}
	}, [view]);

	useEffect(() => {
		setLeadFormAntiBotReady(false);
		const id = window.setTimeout(() => setLeadFormAntiBotReady(true), 2100);
		return () => clearTimeout(id);
	}, [view]);

	useEffect(() => {
		writeStoredOblastAnchorId(selectedFieldCityId);
	}, [selectedFieldCityId]);

	/** Друг таб промени `localStorage` — подравни областта без да ползваме събития от същия таб. */
	useEffect(() => {
		if (typeof window === 'undefined') return;
		const onStorage = (e: StorageEvent) => {
			if (e.storageArea !== localStorage || e.key !== OBLAST_ANCHOR_STORAGE_KEY) return;
			const raw = e.newValue?.trim() ?? '';
			if (!raw) {
				setSelectedFieldCityId((cur) => (cur === 'dobrich' ? cur : 'dobrich'));
				return;
			}
			if (!isValidOblastAnchorId(raw)) return;
			setSelectedFieldCityId((cur) => (cur === raw ? cur : raw));
		};
		window.addEventListener('storage', onStorage);
		return () => window.removeEventListener('storage', onStorage);
	}, []);

	const dealContextForAI = useMemo(() => {
		const cityLabel = lang === 'bg' ? selectedFieldCity.bg : selectedFieldCity.en;
		return `[Field Watch: ${cityLabel}] Leaflet map with draw tools, optional NDVI WMS, weather PDF with manual financial notes. Prioritize agronomic signals and RAG.`;
	}, [lang, selectedFieldCity]);

	useEffect(() => {
		safeLocalSet('agrinexus-lang', lang);
	}, [lang]);

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

	const sendChat = useCallback(async (opts?: SendChatOpts) => {
		const trimmed = (opts?.text ?? chatInput).trim();
		const personaForRequest: ChatPersona = opts?.persona ?? 'unified';
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
				opts?.ragPromptId ?? null,
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
						? 'Грешка при заявка към AI'
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
						? 'OpenAI отхвърли API ключа (грешен, оттеглен или с интервали). Създайте нов ключ на platform.openai.com/api-keys, сложете го в .env като OPENAI_API_KEY=sk-... без кавички, рестартирайте npm run dev; във Vercel обновете Environment Variables.'
						: 'OpenAI rejected the API key (wrong, revoked, or extra spaces). Create a new secret at platform.openai.com/api-keys, set OPENAI_API_KEY in .env (no quotes), restart npm run dev; update Vercel env for production.';
			}
			setChatMessages(prev => [...prev, { role: 'assistant', content: normalized }]);
		} finally {
			if (chatAbortRef.current === controller) chatAbortRef.current = null;
			setChatLoading(false);
		}
	}, [chatInput, chatLoading, chatMessages, dealContextForAI, lang]);

	const runQuickPrompt = useCallback(
		(item: AssistantQuickPromptItem) => {
			if (chatLoading) return;
			const text = quickPromptLabel(item, lang);
			void sendChat({ text, persona: 'unified', ragPromptId: item.id });
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
					? 'Микрофонът се отключва при конфигуриран LLM на сървъра, след регистрация и вход с облачен акаунт или след демо вход с имейл.'
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
					? 'Разпознаването на реч не се поддържа в този браузър — опитайте Chrome или Edge.'
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
			setAssistantNotice(lang === 'bg' ? 'Грешка при разпознаване на реч.' : 'Speech recognition error.');
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
				lang === 'bg' ? 'Не успяхме да стартираме микрофона.' : 'Could not start microphone.'
			);
		}
	}, [mediaAiUnlocked, voiceListening, lang]);

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
					? 'Моля, въведете валиден имейл адрес.'
					: 'Please enter a valid email address.'
			);
			return;
		}
		setRegStatus('loading');
		setRegMsg('');
		try {
			const emailTrim = regEmail.trim();
			const res = await fetch('/api/register-interest', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					fullName: '',
					companyName: '',
					businessEmail: emailTrim,
					phone: '',
					marketFocus: '',
					subscribeAlerts: false,
					locale: lang === 'bg' ? 'bg' : 'en',
					hpCompanyWebsite: regHp,
					formOpenedAt: registerFormOpenedAtRef.current,
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
			persistRegisterAccountHint(emailTrim, cookieConsent);
			const supabaseClient = getSupabaseBrowserClient();
			let cloudAuthMsg: string | null = null;
			let supabaseSignupFailed = false;
			if (supabaseClient) {
				const redirect = `${window.location.origin}${window.location.pathname}`;
				const display = emailTrim.split('@')[0] || '';
				const { error } = await supabaseClient.auth.signInWithOtp({
					email: emailTrim,
					options: {
						emailRedirectTo: redirect,
						data: {
							full_name: display,
							company_name: 'Not specified',
							market_focus: 'Not specified',
							phone: '',
						},
					},
				});
				if (error) {
					const msg = (error.message || '').toLowerCase();
					if (
						msg.includes('already') ||
						msg.includes('registered') ||
						msg.includes('exists')
					) {
						cloudAuthMsg =
							lang === 'bg'
								? 'Този имейл вече е регистриран. Влезте в профила си.'
								: 'This email is already registered. Please sign in.';
					} else {
						cloudAuthMsg =
							`${tr.registerCloudSignupFailedLeadSaved} ${error.message}`.trim();
						supabaseSignupFailed = true;
					}
				} else {
					cloudAuthMsg = tr.registerCloudSignupCheckEmail;
				}
			}
			if (data.mailDelivery === 'skipped') {
				setRegMsg(
					lang === 'bg'
						? 'Заявката е приета, но имейл не е изпратен: задайте RESEND_API_KEY и MAIL_FROM на сървъра (напр. във Vercel Environment Variables).'
						: 'Request received, but no email was sent: set RESEND_API_KEY and MAIL_FROM on the server (e.g. Vercel Environment Variables).'
				);
			} else {
				setRegMsg(
					lang === 'bg'
						? 'Заявката е изпратена към екипа ни — очаквайте потвърждение на посочения имейл.'
						: 'Your request was sent to our team — please expect a confirmation at the email you provided.'
				);
			}
			if (cloudAuthMsg) {
				setRegMsg((prev) => (prev ? `${prev}\n${cloudAuthMsg}` : cloudAuthMsg));
			}
			if (supabaseSignupFailed) {
				setRegStatus('err');
			}
		} catch {
			setRegStatus('err');
			setRegMsg(lang === 'bg' ? 'Мрежова грешка.' : 'Network error.');
		}
	};

	const handleDemoSignIn = () => {
		setLoginMsg('');
		if (!isValidEmail(loginEmail)) {
			setLoginMsg(
				lang === 'bg'
					? 'Въведете валиден имейл, за да продължите към демо средата.'
					: 'Enter a valid email to continue to the demo workspace.'
			);
			return;
		}
		if (loginPassword.trim().length < 4) {
			setLoginMsg(
				lang === 'bg'
					? 'За демо въведете поне 4 знака в полето за парола (не се изпращат към сървър).'
					: 'For demo, enter at least 4 characters in the password field (not sent to any server).'
			);
			return;
		}
		safeLocalSet('agrinexus-demo-email', loginEmail.trim());
		setSessionTick(t => t + 1);
		setView('company');
	};

	const tr = useMemo(() => getUiStrings(lang), [lang]);


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
        html {
          overflow-x: clip;
          overscroll-behavior-x: none;
        }
        body {
          margin: 0;
          font-family: 'DM Sans', Inter, system-ui, Segoe UI, Arial, sans-serif;
          background: var(--bg);
          color: var(--text-main);
          overflow-x: clip;
          overflow-y: visible;
          overscroll-behavior-x: none;
          width: 100%;
          max-width: 100%;
          position: relative;
          min-height: 100svh;
          min-height: 100dvh;
        }
        #root {
          overflow-x: clip;
          overflow-y: visible;
          width: 100%;
          max-width: 100%;
          min-height: 100svh;
          min-height: 100dvh;
        }
        .app {
          position: relative;
          min-height: 100vh;
          min-height: 100dvh;
          width: 100%;
          max-width: 100%;
          overflow-x: clip;
          overscroll-behavior-x: none;
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
        /* Optional film-grain overlay (SVG turbulence avoids extra HTTP requests). */
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
          flex: 1 1 auto;
          position: relative;
          z-index: 2;
          max-width: 100%;
          min-width: 0;
          overflow-x: clip;
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
          justify-content: center;
          gap: 12px;
        }
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
          display: grid;
          grid-template-columns: auto 1fr;
          align-items: center;
          gap: 12px;
          padding: 14px 18px;
          background: rgba(14, 23, 18, 0.82);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border);
          position: sticky; top: 0; z-index: 100; flex-wrap: wrap;
        }
        .brand {
          display: flex; align-items: center; gap: 10px; font-weight: 900; cursor: pointer;
          grid-column: 1;
          justify-self: start;
          transform: none;
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
        .nav-actions {
          grid-column: 2;
          justify-self: end;
          display: flex;
          gap: 6px;
          align-items: center;
          flex-wrap: nowrap;
          white-space: nowrap;
          overflow: visible;
        }

        .nav-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #fff;
          opacity: 0.92;
          padding: 7px 9px;
          border-radius: 8px;
          cursor: pointer;
          border: 1px solid transparent;
          flex: 0 0 auto;
        }
        button.nav-link {
          margin: 0;
          font: inherit;
          text-align: inherit;
          background: transparent;
          appearance: none;
          -webkit-appearance: none;
        }
        a.nav-link {
          text-decoration: none;
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
        main#main-content .section:not(.landing-hero):not(.farm-dash-scope) {
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
        /* Operations dashboard — solid cream panel; avoids WebKit backdrop compositing hiding headings */
        main#main-content .section.farm-dash-scope {
          margin-top: 12px;
          border-radius: 20px;
          backdrop-filter: none;
          -webkit-backdrop-filter: none;
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

        /* Constrain hero width on large screens for readability (marketing layout). */
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
        .landing-hero h1.brand-wordmark {
          width: 100%;
          display: flex;
          justify-content: center;
          text-align: center;
          margin-top: clamp(84px, 16vw, 170px);
          margin-bottom: clamp(8px, 1.6vw, 16px);
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
          transition: box-shadow .22s ease, border-color .22s ease;
        }
        @media (hover: hover) and (pointer: fine) {
          .deal-card {
            transition: transform .2s ease, box-shadow .22s ease, border-color .22s ease;
          }
          .deal-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 18px 34px rgba(0, 0, 0, 0.28);
            border-color: rgba(168, 217, 138, 0.26);
          }
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
          max-width: min(1400px, 100%);
          width: 100%;
          margin-left: auto;
          margin-right: auto;
          box-sizing: border-box;
          padding-left: max(14px, env(safe-area-inset-left, 0px));
          padding-right: max(14px, env(safe-area-inset-right, 0px));
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
          max-height: none;
          min-height: 0;
          width: 100%;
          box-sizing: border-box;
          padding: 14px !important;
          overscroll-behavior-y: contain;
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
          max-height: none;
          overflow-y: visible;
          padding-right: 0;
          scrollbar-gutter: auto;
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
          min-height: 240px;
          max-height: none;
          overflow-y: visible;
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin: 0;
          width: 100%;
          box-sizing: border-box;
          padding: 10px 8px;
        }
        /* По подразбиране: един скрол (страницата). На тесен екран (асистент) — компактен workbench с вътрешен скрол. */
        @media (max-width: 900px) {
          body[data-assistant-route] .assistant-workbench {
            max-height: min(calc(var(--vv-height, 100dvh) - 28px), 960px);
          }
          body[data-assistant-route] .assistant-quick-prompts-scroll {
            max-height: 132px;
            overflow-y: auto;
            padding-left: 6px;
            padding-right: 6px;
          }
          body[data-assistant-route] .assistant-msgs {
            flex: 1 1 auto;
            min-height: 0;
            max-height: none;
            overflow-y: auto;
          }
          html.ios body[data-assistant-route] .assistant-msgs {
            -webkit-overflow-scrolling: touch;
          }
        }
        @media (max-width: 640px) {
          body[data-assistant-route] .assistant-quick-prompts-scroll {
            max-height: min(120px, 28vh);
          }
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

        .ticker-wrap { margin-bottom: 12px; border: 1px solid #2a3d34; border-radius: 10px; background: #101914; overflow: hidden; }
        .ticker-track { display: flex; gap: 20px; width: max-content; padding: 10px 0; animation: scrollDeals 35s linear infinite; }
        .ticker-track:hover { animation-play-state: paused; }
        .ticker-item { white-space: nowrap; font-size: .86rem; color: #cbd5e1; }
        .ticker-item strong { color: var(--accent-text); margin-left: 8px; }
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
        .table-shell {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-x: contain;
          touch-action: pan-x pan-y;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: #101914;
        }
        .table-shell.light {
          background: #fff;
          border-color: rgba(0, 0, 0, 0.12);
        }
        .data-table {
          width: 100%;
          border-collapse: collapse;
          font-size: .88rem;
          min-width: 560px;
        }
        .data-table th,
        .data-table td {
          padding: 10px 12px;
          text-align: left;
          border-bottom: 1px solid rgba(46, 67, 56, 0.6);
          vertical-align: top;
        }
        .data-table thead th {
          color: var(--text-muted);
          font-weight: 700;
          white-space: nowrap;
          border-bottom: 1px solid var(--border);
        }
        .table-shell.light .data-table th,
        .table-shell.light .data-table td {
          border-bottom-color: rgba(0, 0, 0, 0.1);
        }
        .table-shell.light .data-table thead th {
          color: rgba(0, 0, 0, 0.65);
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
          .data-table { min-width: 520px; }
        }

        @media (max-width: 900px) {
          html {
            overscroll-behavior-y: contain;
          }
          body {
            overscroll-behavior-y: contain;
            -webkit-text-size-adjust: 100%;
          }
          .app {
            touch-action: pan-y pinch-zoom;
            max-width: 100%;
          }
          .section { padding: 16px 10px 100px; }
          .section.assistant-route {
            padding-left: max(14px, env(safe-area-inset-left, 0px));
            padding-right: max(14px, env(safe-area-inset-right, 0px));
          }
          main#main-content .section:not(.landing-hero):not(.farm-dash-scope) {
            border-radius: 14px;
            margin-top: 8px;
          }
          main#main-content .section.farm-dash-scope {
            border-radius: 14px;
            margin-top: 8px;
          }
          .nav {
            padding: calc(10px + env(safe-area-inset-top, 0px)) 12px 10px;
            position: sticky;
            min-height: 58px;
          }
          .brand {
            grid-column: 1;
            justify-self: start;
            transform: none;
          }
          .nav-actions { gap: 6px; }
          .nav-link { padding: 7px 8px; font-size: .86rem; }
          .nav-link-mobile-hide { display: none !important; }
          .btn { padding: 10px 12px; border-radius: 10px; }
          .deal-card, .ai-card, .contact-panel, .client-card { padding: 12px; border-radius: 12px; }
          .deal-card h3 { font-size: 1rem; }
          .muted { font-size: .9rem; }

          .site-footer { padding-bottom: 118px; }

          .mobile-nav {
            position: fixed;
            left: max(10px, env(safe-area-inset-left, 0px));
            right: max(10px, env(safe-area-inset-right, 0px));
            bottom: calc(10px + env(safe-area-inset-bottom, 0px) + var(--keyboard-cover, 0px));
            z-index: 160;
            width: auto;
            box-sizing: border-box;
            overflow-x: hidden;
            overflow-y: auto;
            overscroll-behavior: contain;
            -webkit-overflow-scrolling: touch;
            background: rgba(14, 22, 18, 0.97);
            border: 1px solid #3d5248;
            border-radius: 14px;
            padding: 6px;
            display: flex;
            flex-direction: column;
            gap: 2px;
            backdrop-filter: blur(6px);
            transform: translateZ(0);
            max-height: min(52vh, 380px);
          }
          html.ios .mobile-nav {
            transform: translateZ(0);
          }
          .mobile-nav-row {
            display: flex;
            flex-direction: row;
            flex-wrap: nowrap;
            gap: 3px;
            min-width: 0;
            flex-shrink: 0;
            overflow-x: auto;
            overflow-y: hidden;
            overscroll-behavior-x: contain;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
          }
          .mobile-nav-row::-webkit-scrollbar {
            display: none;
          }
          .mobile-nav-row > .mobile-nav-btn {
            flex: 0 0 auto;
            min-width: 62px;
            max-width: 88px;
          }
          .mobile-nav-subrow {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 3px;
            padding: 3px 0 1px;
            margin-top: 1px;
            border-top: 1px solid rgba(124, 205, 156, 0.18);
            min-width: 0;
            flex-shrink: 0;
          }
          .mobile-nav-subrow.cols-2 {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .mobile-nav-btn {
            border: 1px solid transparent;
            background: #101914;
            color: #cbd5e1;
            border-radius: 10px;
            padding: 6px 3px;
            min-height: 44px;
            min-width: 0;
            max-width: 100%;
            font-size: .65rem;
            font-weight: 700;
            font-family: inherit;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            gap: 4px;
            transition: background .15s ease, border-color .15s ease, color .15s ease, opacity .12s ease;
            touch-action: manipulation;
            overflow: hidden;
            box-sizing: border-box;
          }
          .mobile-nav-btn:active {
            opacity: 0.88;
            background: #0c1310;
          }
          a.mobile-nav-btn {
            text-decoration: none;
            box-sizing: border-box;
            -webkit-tap-highlight-color: transparent;
          }
          .mobile-nav-btn svg {
            width: 15px;
            height: 15px;
          }
          .mobile-nav-label {
            display: block;
            overflow: hidden;
            width: 100%;
            max-width: 100%;
            min-width: 0;
            line-height: 1.14;
            text-align: center;
            white-space: nowrap;
            text-overflow: ellipsis;
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
            transition: opacity 0.15s ease;
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
          .mobile-nav-btn:active {
            opacity: 1;
          }
          body[data-assistant-route][data-vk-open] .mobile-nav {
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
									className={`nav-dropdown-item ${view === 'weather' ? 'active' : ''}`}
									onClick={() => {
										setView('weather');
										setNavMenuOpen(null);
									}}>
									<CloudRain size={14} aria-hidden /> {tr.navMeteoPdf}
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
					<a
						className="nav-link nav-link-mobile-hide"
						href="/fieldlot.html"
						aria-label={tr.navFieldlotAria}>
						<Sprout size={14} aria-hidden />
						{tr.navFieldlot}
					</a>
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
									<FileImage size={14} aria-hidden /> {tr.fieldWatchPageTitle}
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
						<button
							type="button"
							className={`nav-link nav-link-mobile-hide ${view === 'watchlist' ? 'active' : ''}`}
							onClick={() => setView('watchlist')}>
							{tr.navWatchlist}
						</button>
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
					</div>
				</section>
			)}

			{view === 'assistant' && (
				<section className="section assistant-route">
					<div className="assistant-route-actions">
						<button
							type="button"
							className="btn btn-outline"
							style={{ marginBottom: 0 }}
							onClick={() => setView('landing')}>
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
										? `Временен проблем с /api/chat. Отворете ${browserOrigin || 'http://localhost:5173'}/api/chat в нов раздел и очаквайте JSON с "ok": true. Ако не стане, стартирайте npm run dev (не само dev:vite) и натиснете Ctrl+F5.`
										: `Няма достъп до /api/chat от ${browserOrigin || 'този произход'}. Отворете ${browserOrigin}/api/chat и очаквайте JSON с "ok": true и mistralConfigured (или друг LLM). На Vercel: домейнът към този проект, Environment Variables за Production с MISTRAL_API_KEY, после Redeploy; проверете Logs при Functions при грешка.`,
									isLikelyLocalDev
										? `Temporary issue calling /api/chat. Open ${browserOrigin || 'http://localhost:5173'}/api/chat in a new tab and expect JSON with "ok": true. If not, run npm run dev (not dev:vite alone) and try Ctrl+F5.`
										: `Cannot reach /api/chat from ${browserOrigin || 'this origin'}. Open ${browserOrigin}/api/chat and expect JSON with "ok": true and mistralConfigured (or another LLM). On Vercel: point the domain at this project, set Production env MISTRAL_API_KEY (or OPENAI_API_KEY), Redeploy; check Functions logs on failure.`
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
									'Няма конфигуриран LLM за чат: задайте MISTRAL_API_KEY (EU облак), OPENAI_API_KEY или локален Ollama (OLLAMA_BASE_URL=http://127.0.0.1:11434 и OLLAMA_MODEL) в .env в корена на проекта; после рестартирайте npm run dev. На Vercel задайте същите променливи в Environment Variables.',
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
										disabled={chatLoading}
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
				<OperationsHubView tr={tr} lang={lang} onNavigate={v => setView(v as View)} />
			)}

			{view === 'register' && (
				<section className="section" style={{ position: 'relative' }}>
					<h2>{tr.registerTitle}</h2>
					<p className="muted">{tr.registerSubtitle}</p>
					<div
						aria-hidden="true"
						style={{
							position: 'absolute',
							left: -9999,
							width: 1,
							height: 1,
							overflow: 'hidden',
						}}>
						<input
							id="agrinexus-reg-hp"
							name={LEAD_FORM_HP_FIELD}
							type="text"
							tabIndex={-1}
							autoComplete="off"
							value={regHp}
							onChange={(e) => setRegHp(e.target.value)}
						/>
					</div>
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
						{supabaseRegisterEnabled ? (
							<p
								className="muted"
								style={{
									gridColumn: '1 / -1',
									margin: '0',
									fontSize: '.82rem',
								}}>
								{lang === 'bg'
									? 'Ще изпратим връзка за вход на този имейл (без парола в тази форма).'
									: 'We will send a sign-in link to this email (no password on this form).'}
							</p>
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
						<h2 style={{ margin: 0 }}>{tr.fieldWatchPageTitle}</h2>
						<a
							className="btn btn-outline"
							href={`/agrinexus-field-watch.html?oblast=${encodeURIComponent(selectedFieldCityId)}&lang=${lang}`}
							target="_blank"
							rel="noreferrer">
							{tr.fieldWatchOpenLegacy}
						</a>
					</div>
					<p className="muted" style={{ marginTop: 0, marginBottom: 12 }}>
						{tr.fieldWatchPageSubtitle}
					</p>
					<div
						className="contact-panel"
						style={{ marginBottom: 12, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
						<label style={{ fontSize: '.88rem' }}>{tr.weatherOblastLabel}</label>
						<select
							value={selectedFieldCityId}
							onChange={(event) => setSelectedFieldCityId(event.target.value)}
							style={{ minWidth: 220 }}>
							{FIELD_WATCH_OBLAST_PRESETS.map((city) => (
								<option key={city.id} value={city.id}>
									{lang === 'bg' ? city.bg : city.en}
								</option>
							))}
						</select>
						<button
							type="button"
							className="btn btn-primary"
							onClick={() => setFieldWatchRecenterNonce((n) => n + 1)}>
							{tr.fieldWatchCenterMapOnOblast}
						</button>
					</div>
					<p className="muted" style={{ margin: '0 0 12px', fontSize: '.82rem', lineHeight: 1.45 }}>
						{tr.fieldWatchMapToolbarHint}
					</p>
					<div
						style={{
							border: '1px solid var(--line)',
							borderRadius: 14,
							overflow: 'hidden',
							background: '#0b1120',
							minHeight: isMobileViewport ? '62vh' : 'min(760px, 74vh)',
						}}>
						<FieldWatchLeaflet
							lang={lang}
							initialLat={selectedFieldCity.lat}
							initialLon={selectedFieldCity.lon}
							initialZoom={12}
							recenterNonce={fieldWatchRecenterNonce}
							onWeatherAnchor={() => setView('weather')}
						/>
					</div>
					<div
						className="contact-panel"
						style={{
							marginTop: 12,
							display: 'flex',
							flexWrap: 'wrap',
							gap: 10,
							alignItems: 'center',
						}}>
						<button
							type="button"
							className="btn btn-outline"
							onClick={() => {
								const cityLabel = lang === 'bg' ? selectedFieldCity.bg : selectedFieldCity.en;
								const prompt =
									lang === 'bg'
										? `Дай ми агро прогноза с RAG за област ${cityLabel}: риск от суша, препоръчителни култури и 3 практически действия за следващите 30 дни.`
										: `Give me a RAG-backed agri forecast for ${cityLabel} oblast: drought risk, recommended crops, and 3 practical actions for the next 30 days.`;
								setChatInput(prompt);
								setPendingAutoChatPrompt(prompt);
								setView('assistant');
							}}>
							{tr.fieldWatchAskAiOblast}
						</button>
						<span className="muted" style={{ fontSize: '.8rem', lineHeight: 1.4, maxWidth: 520 }}>
							{tr.fieldWatchAskAiOblastHint}
						</span>
					</div>
				</section>
			)}

			{view === 'weather' && (
				<WeatherFarmView
					lang={lang}
					tr={tr}
					cityId={selectedFieldCityId}
					onCityIdChange={setSelectedFieldCityId}
					onOpenFieldWatch={() => setView('field-watch')}
				/>
			)}

			{view === 'trade-documents' && <TradeDocumentsBulgariaView lang={lang} tr={tr} />}

			{view === 'crop-statistics' && (
				<CropStatisticsBulgariaView
					lang={lang}
					tr={tr}
					onOpenFoodSecurity={() => setView('food-security')}
				/>
			)}
			{view === 'food-security' && (
				<FoodSecurityBreakEvenView
					lang={lang}
					tr={tr}
					syncOblastId={selectedFieldCityId}
					onSyncOblastChange={setSelectedFieldCityId}
				/>
			)}

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
					<FileUploadPanel senderEmail={identityEmailForAi ?? undefined} lang={lang} />
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
									clearRegisterAccountHint();
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
											{profile.contactPerson} ? {profileLocalized.region}
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
								{selectedClientLocalized.role} ? {selectedClientLocalized.contactPerson}
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
					<div className="site-footer-links">
						<a className="footer-link-btn" href="mailto:info@agrinexus.eu">
							info@agrinexus.eu
						</a>
						<span className="site-footer-sep" aria-hidden>
							·
						</span>
						<a className="footer-link-btn" href="/fieldlot.html">
							{tr.footerFieldlot}
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
						left: 'max(16px, env(safe-area-inset-left, 0px))',
						right: 'max(16px, env(safe-area-inset-right, 0px))',
						bottom: isMobileViewport ? 102 : 16,
						zIndex: isMobileViewport ? 140 : 1200,
						margin: 0,
						maxWidth: isMobileViewport ? undefined : 720,
						marginInline: 'auto',
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
				<div
					className="mobile-nav"
					role="navigation"
					aria-label={tr.mobileNavAria}>
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
						<a
							className="mobile-nav-btn"
							href="/fieldlot.html"
							aria-label={tr.navFieldlotAria}
							onClick={() => setMobileNavExpand(null)}>
							<Sprout size={16} aria-hidden />
							<MobileNavLabel text={tr.navFieldlot} hint={tr.navFieldlotAria} />
						</a>
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
							<button
								type="button"
								className={`mobile-nav-btn ${view === 'watchlist' ? 'active' : ''}`}
								onClick={() => setView('watchlist')}
								aria-label={tr.navWatchlist}>
								<Bookmark size={16} aria-hidden />
								<MobileNavLabel text={tr.navWatchlistShort} hint={tr.navWatchlist} />
							</button>
						)}
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
					{mobileNavExpand === 'markets' && (
						<div className="mobile-nav-subrow">
							<button
								type="button"
								className={`mobile-nav-btn ${view === 'weather' ? 'active' : ''}`}
								aria-label={tr.navMeteoPdf}
								onClick={() => {
									setView('weather');
									setMobileNavExpand(null);
								}}>
								<CloudRain size={16} aria-hidden />
								<MobileNavLabel text={tr.navMeteoPdf} hint={tr.weatherTitle} />
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
					{mobileNavExpand === 'farm' && (
						<div className="mobile-nav-subrow">
							<button
								type="button"
								className={`mobile-nav-btn ${view === 'field-watch' ? 'active' : ''}`}
								aria-label={tr.fieldWatchPageTitle}
								onClick={() => {
									setView('field-watch');
									setMobileNavExpand(null);
								}}>
								<FileImage size={16} aria-hidden />
								<MobileNavLabel
									text={tr.fieldWatchMobileShort}
									hint={tr.fieldWatchPageTitle}
								/>
							</button>
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


import { useCallback, useEffect, useMemo, useState } from 'react';
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
    flag: 'ðŸ‡¦ðŸ‡ª',
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
    flag: 'ðŸ‡©ðŸ‡ª',
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
    flag: 'ðŸ‡ªðŸ‡¬',
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
    flag: 'ðŸ‡¸ðŸ‡¦',
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

function getVolatility(current: number, previous: number): 'LOW' | 'MED' | 'HIGH' {
  const delta = Math.abs(current - previous);
  if (delta >= 5) return 'HIGH';
  if (delta >= 3) return 'MED';
  return 'LOW';
}

type DealRow = {
  id: number;
  product: string;
  packaging: string;
  certification: string;
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

type ChatTurn = { role: 'user' | 'assistant'; content: string };
type View = 'landing' | 'market' | 'pricing' | 'register' | 'login' | 'company' | 'clients' | 'watchlist';
type Lang = 'bg' | 'en';

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

const QUICK_PROMPTS = [
  'Ð”Ð°Ð¹ BUY/HOLD/AVOID Ð·Ð° Ð´Ð¾Ð¼Ð°Ñ‚Ð¸ Ð‘ÑŠÐ»Ð³Ð°Ñ€Ð¸Ñ -> UAE.',
  'ÐšÐ¾Ð¸ ÑÐµÑ€Ñ‚Ð¸Ñ„Ð¸ÐºÐ°Ñ‚Ð¸ ÑÐ° ÐºÑ€Ð¸Ñ‚Ð¸Ñ‡Ð½Ð¸ Ð·Ð° export ÐºÑŠÐ¼ KSA?',
  'ÐÐ°Ð¿Ñ€Ð°Ð²Ð¸ Ð±ÑŠÑ€Ð· risk-check Ð·Ð° EU to MENA route.',
];

const MARKET_FLASH = [
  'Tomato paste corridor TR -> KSA showing tighter spreads this session.',
  'Sunflower oil bids from Egypt remain strong for next 2 loading windows.',
  'Premium wheat routes into EU show HOLD bias due to freight pressure.',
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

function PricingCard({
  title,
  price,
  period,
  note = '',
  popular = false,
}: {
  title: string;
  price: string;
  period: string;
  note?: string;
  popular?: boolean;
}) {
  const handleSubscribe = () => {
    const subject = encodeURIComponent(`Subscription Inquiry: ${title} Plan`);
    const body = encodeURIComponent(
      `Hello, I would like to subscribe to the ${title} plan (â‚¬${price}/${period}) for AgriNexus. Please reach me at info@agrinexus.eu for onboarding.\n`
    );
    window.location.href = `mailto:info@agrinexus.eu?subject=${subject}&body=${body}`;
  };

  return (
    <div className={`pricing-card ${popular ? 'popular' : ''}`}>
      {popular && <div className="badge">BEST VALUE</div>}
      <h3>{title}</h3>
      <div className="pricing-value">â‚¬{price}</div>
      <p className="muted">per {period}</p>
      {note && <p className="green-note">{note}</p>}
      <button className={`btn ${popular ? 'btn-primary' : 'btn-light'}`} onClick={handleSubscribe}>
        <CreditCard size={18} /> Subscribe
      </button>
    </div>
  );
}

async function apiChat(messages: ChatTurn[], dealContext: string): Promise<string> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, dealContext }),
  });
  const data = (await res.json()) as { reply?: string; error?: string; hint?: string };
  if (!res.ok) {
    throw new Error(data.hint || data.error || 'Chat request failed');
  }
  if (!data.reply) throw new Error('Empty AI response');
  return data.reply;
}

export default function App() {
  const [view, setView] = useState<View>('landing');
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('agrinexus-lang') === 'en' ? 'en' : 'bg'));
  const [isPremium] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [nextUpdate, setNextUpdate] = useState(30 * 60);
  const [refreshTick, setRefreshTick] = useState(0);
  const [lastRefreshAt, setLastRefreshAt] = useState(new Date());
  const [marketFlashIndex, setMarketFlashIndex] = useState(0);
  const [selectedClientId, setSelectedClientId] = useState(CLIENT_PROFILES[0].id);
  const [chatMessages, setChatMessages] = useState<ChatTurn[]>([
    {
      role: 'assistant',
      content:
        'Ð—Ð´Ñ€Ð°Ð²ÐµÐ¹Ñ‚Ðµ! ÐÐ· ÑÑŠÐ¼ AgriNexus AI. ÐŸÐ¸Ñ‚Ð°Ð¹Ñ‚Ðµ Ð·Ð° Ð¼Ð°Ñ€ÑˆÑ€ÑƒÑ‚Ð¸ EU/MENA, Ð¼Ð°Ñ€Ð¶, ÑÐµÑ€Ñ‚Ð¸Ñ„Ð¸ÐºÐ°Ñ‚Ð¸ Ð¸Ð»Ð¸ Ð·Ð° BUY/HOLD/AVOID â€” Ð¼Ð¾Ð³Ð° Ð´Ð° Ð¿Ð¾Ð»Ð·Ð²Ð°Ð¼ ÐºÐ¾Ð½Ñ‚ÐµÐºÑÑ‚Ð° Ð¾Ñ‚ Ñ‚ÐµÐºÑƒÑ‰Ð¸Ñ Ð²Ð¸ marketplace Ð¿Ñ€ÐµÐ³Ð»ÐµÐ´.',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

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
  const [alertsMuted, setAlertsMuted] = useState<boolean>(() => localStorage.getItem('agrinexus-alerts-muted') === '1');

  const allDeals = useMemo(() => {
    const products = [
      { name: 'Peeled Tomatoes', pack: '400g Tin Can', cert: 'HALAL, ISO' },
      { name: 'Roasted Peppers', pack: '720ml Glass Jar', cert: 'HALAL, Saber' },
      { name: 'Wheat (Premium)', pack: 'Bulk (Silo)', cert: 'SGS Inspection' },
      { name: 'Rose Jam', pack: '380g Luxury Glass', cert: 'HALAL, Export' },
      { name: 'Vegetable Stew', pack: '3kg Horeca Tin', cert: 'HALAL, ISO 22000' },
      { name: 'Barley', pack: 'Bulk', cert: 'Phytosanitary Cert' },
      { name: 'Tomato Paste', pack: '70g Sachet / 24pcs', cert: 'HALAL, Saber' },
      { name: 'Sunflower Oil', pack: '1L / 5L PET', cert: 'ISO 22000, HACCP' },
      { name: 'Corn', pack: 'Bulk', cert: 'SGS, Phytosanitary' },
      { name: 'Chickpeas', pack: '25kg PP Bags', cert: 'HALAL, Export' },
    ];

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
      { to: 'Cairo, Egypt', cur: 'EGP', mult: 56, flag: 'ðŸ‡ªðŸ‡¬', region: 'MENA', demandBoost: 1.2 },
      { to: 'Alexandria, Egypt', cur: 'EGP', mult: 56, flag: 'ðŸ‡ªðŸ‡¬', region: 'MENA', demandBoost: 1.15 },
      { to: 'Dubai, UAE', cur: 'AED', mult: 4, flag: 'ðŸ‡¦ðŸ‡ª', region: 'MENA', demandBoost: 1.1 },
      { to: 'Abu Dhabi, UAE', cur: 'AED', mult: 4, flag: 'ðŸ‡¦ðŸ‡ª', region: 'MENA', demandBoost: 1.05 },
      { to: 'Riyadh, KSA', cur: 'SAR', mult: 4.1, flag: 'ðŸ‡¸ðŸ‡¦', region: 'MENA', demandBoost: 1.1 },
      { to: 'Jeddah, KSA', cur: 'SAR', mult: 4.1, flag: 'ðŸ‡¸ðŸ‡¦', region: 'MENA', demandBoost: 1.08 },
      { to: 'Doha, Qatar', cur: 'QAR', mult: 4, flag: 'ðŸ‡¶ðŸ‡¦', region: 'MENA', demandBoost: 1.07 },
      { to: 'Kuwait City, Kuwait', cur: 'KWD', mult: 0.31, flag: 'ðŸ‡°ðŸ‡¼', region: 'MENA', demandBoost: 1.08 },
      { to: 'Amman, Jordan', cur: 'JOD', mult: 0.71, flag: 'ðŸ‡¯ðŸ‡´', region: 'MENA', demandBoost: 1.04 },
      { to: 'Casablanca, Morocco', cur: 'MAD', mult: 10.7, flag: 'ðŸ‡²ðŸ‡¦', region: 'MENA', demandBoost: 1.02 },
      { to: 'Berlin, Germany', cur: 'EUR', mult: 1, flag: 'ðŸ‡©ðŸ‡ª', region: 'EU', demandBoost: 0.96 },
      { to: 'Milan, Italy', cur: 'EUR', mult: 1, flag: 'ðŸ‡®ðŸ‡¹', region: 'EU', demandBoost: 0.95 },
      { to: 'Paris, France', cur: 'EUR', mult: 1, flag: 'ðŸ‡«ðŸ‡·', region: 'EU', demandBoost: 0.95 },
      { to: 'Madrid, Spain', cur: 'EUR', mult: 1, flag: 'ðŸ‡ªðŸ‡¸', region: 'EU', demandBoost: 0.94 },
      { to: 'Amsterdam, Netherlands', cur: 'EUR', mult: 1, flag: 'ðŸ‡³ðŸ‡±', region: 'EU', demandBoost: 0.93 },
      { to: 'Warsaw, Poland', cur: 'PLN', mult: 4.3, flag: 'ðŸ‡µðŸ‡±', region: 'EU', demandBoost: 0.96 },
      { to: 'Athens, Greece', cur: 'EUR', mult: 1, flag: 'ðŸ‡¬ðŸ‡·', region: 'EU', demandBoost: 0.94 },
      { to: 'Bucharest, Romania', cur: 'RON', mult: 5, flag: 'ðŸ‡·ðŸ‡´', region: 'EU', demandBoost: 0.95 },
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
      const prevRandomFactor = Math.floor(seededRand(i + 1 + Math.max(0, refreshTick - 1)) * 13);
      const profit = Math.round((base + randomFactor) * market.demandBoost);
      const prevProfit = Math.round((base + prevRandomFactor) * market.demandBoost);
      const margin = Math.max(5, profit - 4);
      const currentPrice = `${(seededRand(i + 99 + refreshTick) * 8 * market.mult + 0.35).toFixed(2)} ${market.cur}`;
      const prevPrice = `${(seededRand(i + 99 + Math.max(0, refreshTick - 1)) * 8 * market.mult + 0.35).toFixed(2)} ${market.cur}`;

      return {
        id: i + 1,
        product: product.name,
        packaging: product.pack,
        certification: product.cert,
        from: sourceCountries[i % sourceCountries.length],
        to: market.to,
        flag: market.flag,
        profit,
        prevProfit,
        margin,
        price: currentPrice,
        prevPrice,
        isMENA: market.region === 'MENA',
        decision: getDecisionByProfit(profit),
        volatility: getVolatility(profit, prevProfit),
      } satisfies DealRow;
    });
  }, [refreshTick]);

  const filteredDeals = allDeals.filter((d) => {
    const q = searchQuery.toLowerCase();
    return (
      d.product.toLowerCase().includes(q) ||
      d.from.toLowerCase().includes(q) ||
      d.to.toLowerCase().includes(q)
    );
  });

  const dealContextForAI = useMemo(() => {
    const slice = filteredDeals.slice(0, 18);
    return slice
      .map(
        (d) =>
          `#${d.id} ${d.product} | ${d.from}â†’${d.to} | ${d.decision} | est. +${d.profit}% | ${d.price}`
      )
      .join('\n');
  }, [filteredDeals]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNextUpdate((prev) => {
        if (prev <= 1) {
          setRefreshTick((v) => v + 1);
          setLastRefreshAt(new Date());
          return 30 * 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const flashTimer = setInterval(() => {
      setMarketFlashIndex((v) => (v + 1) % MARKET_FLASH.length);
    }, 9000);
    return () => clearInterval(flashTimer);
  }, []);

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
    CLIENT_PROFILES.find((profile) => profile.id === selectedClientId) || CLIENT_PROFILES[0];
  const tickerItems = filteredDeals.slice(0, 12);
  const watchedDeals = allDeals.filter((deal) => watchlistIds.includes(deal.id));
  const topMovers = useMemo(
    () => [...filteredDeals].sort((a, b) => Math.abs(b.profit - b.prevProfit) - Math.abs(a.profit - a.prevProfit)).slice(0, 4),
    [filteredDeals]
  );

  const toggleWatchlist = (dealId: number) => {
    setWatchlistIds((prev) => (prev.includes(dealId) ? prev.filter((id) => id !== dealId) : [...prev, dealId]));
  };

  const toggleAlert = (dealId: number) => {
    setAlertsEnabledIds((prev) => (prev.includes(dealId) ? prev.filter((id) => id !== dealId) : [...prev, dealId]));
  };

  const sendChat = useCallback(async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || chatLoading) return;
    setChatError(null);
    const nextUser: ChatTurn = { role: 'user', content: trimmed };
    const history = [...chatMessages, nextUser];
    setChatMessages(history);
    setChatInput('');
    setChatLoading(true);
    try {
      const payload = history.filter((m) => m.role === 'user' || m.role === 'assistant').slice(-16);
      const reply = await apiChat(payload, dealContextForAI);
      setChatMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Ð“Ñ€ÐµÑˆÐºÐ° Ð¿Ñ€Ð¸ AI Ð·Ð°ÑÐ²ÐºÐ°';
      const normalized = msg.includes('OpenAI is not configured')
        ? 'AI Ñ‡Ð°Ñ‚ÑŠÑ‚ Ð½Ðµ Ðµ ÐºÐ¾Ð½Ñ„Ð¸Ð³ÑƒÑ€Ð¸Ñ€Ð°Ð½. Ð”Ð¾Ð±Ð°Ð²Ð¸ OPENAI_API_KEY Ð² .env (Ð»Ð¾ÐºÐ°Ð»Ð½Ð¾) Ð¸Ð»Ð¸ Vercel Environment Variables.'
        : msg;
      setChatError(msg);
      setChatMessages((prev) => [...prev, { role: 'assistant', content: normalized }]);
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatLoading, chatMessages, dealContextForAI]);

  const applyQuickPrompt = (prompt: string) => {
    setChatInput(prompt);
    setIsChatOpen(true);
  };

  const forceRefreshDeals = () => {
    setRefreshTick((v) => v + 1);
    setLastRefreshAt(new Date());
    setNextUpdate(30 * 60);
  };

  const submitRegister = async () => {
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
          phone: regPhone,
          marketFocus: regMarket,
          subscribeAlerts: regSubscribe,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; hint?: string; preview?: string };
      if (!res.ok) {
        setRegStatus('err');
        setRegMsg(data.hint || data.error || 'ÐÐµÑƒÑÐ¿ÐµÑˆÐ½Ð¾ Ð¸Ð·Ð¿Ñ€Ð°Ñ‰Ð°Ð½Ðµ');
        return;
      }
      setRegStatus('ok');
      setRegMsg('Ð˜Ð·Ð¿Ñ€Ð°Ñ‚ÐµÐ½Ð¾ Ð´Ð¾ info@agrinexus.eu â€” Ð¾Ñ‡Ð°ÐºÐ²Ð°Ð¹Ñ‚Ðµ Ð¿Ð¾Ñ‚Ð²ÑŠÑ€Ð¶Ð´ÐµÐ½Ð¸Ðµ Ð½Ð° Ð¸Ð¼ÐµÐ¹Ð»Ð° Ð²Ð¸.');
      setRegPassword('');
    } catch {
      setRegStatus('err');
      setRegMsg('ÐœÑ€ÐµÐ¶Ð¾Ð²Ð° Ð³Ñ€ÐµÑˆÐºÐ°.');
    }
  };

  const submitContact = async () => {
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
      const data = (await res.json()) as { ok?: boolean; error?: string; hint?: string };
      if (!res.ok) {
        setContactStatus('err');
        setContactFeedback(data.hint || data.error || 'ÐÐµÑƒÑÐ¿ÐµÑˆÐ½Ð¾ Ð¸Ð·Ð¿Ñ€Ð°Ñ‰Ð°Ð½Ðµ');
        return;
      }
      setContactStatus('ok');
      setContactFeedback('Ð¡ÑŠÐ¾Ð±Ñ‰ÐµÐ½Ð¸ÐµÑ‚Ð¾ Ðµ Ð¸Ð·Ð¿Ñ€Ð°Ñ‚ÐµÐ½Ð¾. ÐžÑ‚Ð³Ð¾Ð²Ð¾Ñ€ÑŠÑ‚ Ð¸Ð´Ð²Ð° Ð¾Ñ‚ info@agrinexus.eu.');
      setContactBody('');
    } catch {
      setContactStatus('err');
      setContactFeedback('ÐœÑ€ÐµÐ¶Ð¾Ð²Ð° Ð³Ñ€ÐµÑˆÐºÐ°.');
    }
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
        @keyframes scrollDeals { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .nav { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 14px 18px; background: var(--panel-2); border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 100; flex-wrap: wrap; }
        .brand { display: flex; align-items: center; gap: 10px; font-weight: 900; cursor: pointer; }
        .nav-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .nav-link { color: #fff; opacity: 0.92; padding: 8px 10px; border-radius: 8px; cursor: pointer; border: 1px solid transparent; }
        .nav-link.active { color: var(--green); background: rgba(34, 197, 94, 0.08); }
        .btn { border: none; border-radius: 12px; cursor: pointer; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 11px 16px; }
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
        .preview-mask { overflow: hidden; mask-image: linear-gradient(to right, transparent, black 40px, black calc(100% - 40px), transparent); -webkit-mask-image: linear-gradient(to right, transparent, black 40px, black calc(100% - 40px), transparent); }
        .deals-track { display: flex; gap: 16px; width: max-content; animation: scrollDeals 24s linear infinite; }
        .deals-track:hover { animation-play-state: paused; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
        .deal-card, .pricing-card { background: var(--panel); border: 1px solid var(--border); border-radius: 16px; padding: 14px; position: relative; }
        .deal-card.top { border: 2px solid var(--green); }
        .pricing-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 14px; }
        .pricing-card { text-align: center; padding: 20px; }
        .pricing-card.popular { border: 2px solid var(--green); }
        .badge { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: var(--green); padding: 5px 10px; border-radius: 999px; font-size: .73rem; font-weight: 800; }
        .pricing-value { font-size: 2rem; font-weight: 900; margin: 10px 0; }
        .market-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 18px; }
        .ticker-wrap { margin-bottom: 12px; border: 1px solid #1f2937; border-radius: 10px; background: #0b1221; overflow: hidden; }
        .ticker-track { display: flex; gap: 20px; width: max-content; padding: 10px 0; animation: scrollDeals 35s linear infinite; }
        .ticker-track:hover { animation-play-state: paused; }
        .ticker-item { white-space: nowrap; font-size: .86rem; color: #d1fae5; }
        .ticker-item strong { color: #22c55e; margin-left: 8px; }
        .market-flash { margin-top: 16px; background: rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 10px; padding: 11px 13px; color: #bbf7d0; font-size: .9rem; }
        .search-wrap { position: relative; width: min(100%, 480px); flex: 1; }
        .search-wrap input { width: 100%; padding: 12px 12px 12px 42px; border-radius: 12px; outline: none; background: #1e293b; color: #fff; border: 1px solid #334155; }
        .search-icon { position: absolute; left: 13px; top: 11px; color: #64748b; }
        .locked-overlay { position: absolute; inset: 0; border-radius: 16px; background: rgba(11, 18, 33, 0.56); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; }
        .muted { color: var(--text-muted); }
        .green-note { color: var(--green); font-weight: 700; }
        .contact-panel { background: var(--panel); border: 1px solid var(--border); border-radius: 14px; padding: 14px; margin-top: 16px; }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .form-grid input, .form-grid select, .form-grid textarea { width: 100%; padding: 11px; border-radius: 10px; border: 1px solid #334155; background: #1e293b; color: #fff; font-family: inherit; }
        .chat-box { position: fixed; right: 12px; bottom: 12px; z-index: 200; }
        .chat-window { width: min(92vw, 380px); background: #1e293b; border: 1px solid #334155; border-radius: 14px; padding: 12px; margin-bottom: 8px; display: flex; flex-direction: column; max-height: min(70vh, 520px); }
        .chat-messages { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; margin-bottom: 10px; padding-right: 4px; }
        .chat-bubble { align-self: flex-start; max-width: 100%; padding: 10px 12px; border-radius: 12px; font-size: .9rem; line-height: 1.45; }
        .chat-bubble.user { align-self: flex-end; background: rgba(34, 197, 94, 0.15); border: 1px solid rgba(34, 197, 94, 0.35); }
        .chat-bubble.assistant { background: #0f172a; border: 1px solid #334155; }
        .chat-input-row { display: flex; gap: 8px; align-items: flex-end; }
        .chat-input-row textarea { flex: 1; resize: none; min-height: 44px; max-height: 120px; padding: 10px; border-radius: 10px; border: 1px solid #334155; background: #0b1221; color: #fff; font-family: inherit; }
        .chat-prompt-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
        .chat-prompt-chip { border: 1px solid #334155; background: #0f172a; color: #cbd5e1; border-radius: 999px; padding: 6px 10px; font-size: .76rem; cursor: pointer; }
        .chat-actions { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 8px; }
        .btn-mini { background: transparent; color: #94a3b8; border: 1px solid #334155; border-radius: 8px; padding: 5px 9px; cursor: pointer; font-size: .76rem; }
        .live-dot { width: 8px; height: 8px; background: #22c55e; border-radius: 999px; display: inline-block; margin-right: 6px; box-shadow: 0 0 0 rgba(34, 197, 94, .7); animation: pulse 1.6s infinite; }
        @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, .6); } 100% { box-shadow: 0 0 0 10px rgba(34, 197, 94, 0); } }
        .clients-layout { display: grid; grid-template-columns: 340px 1fr; gap: 14px; }
        .client-list { background: var(--panel); border: 1px solid var(--border); border-radius: 14px; padding: 10px; }
        .client-list-item { width: 100%; text-align: left; border: 1px solid transparent; background: #0f172a; color: #fff; padding: 10px; border-radius: 10px; margin-bottom: 8px; cursor: pointer; }
        .client-list-item.active { border-color: #22c55e; background: rgba(34, 197, 94, 0.08); }
        .client-card { background: var(--panel); border: 1px solid var(--border); border-radius: 14px; padding: 16px; }
        .client-meta-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 12px; }
        .meta-kv { background: #0f172a; border: 1px solid #1f2937; border-radius: 10px; padding: 10px; }
        .status-pill { display: inline-flex; padding: 4px 8px; border-radius: 999px; font-size: .74rem; font-weight: 700; background: rgba(34, 197, 94, 0.13); color: #4ade80; }
        .terminal-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin: 10px 0 14px; }
        .terminal-metric { background: #0b1221; border: 1px solid #1f2937; border-radius: 8px; padding: 8px 10px; }
        .terminal-metric strong { color: #86efac; display: block; font-size: 1.05rem; }
        .terminal-metric span { color: #94a3b8; font-size: .76rem; }
        .deal-actions { margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap; }
        .deal-chip-btn { border: 1px solid #334155; background: #0f172a; color: #cbd5e1; border-radius: 999px; padding: 5px 10px; font-size: .74rem; cursor: pointer; }
        .deal-chip-btn.active { border-color: #22c55e; color: #86efac; }
        .chat-trigger { width: 54px; height: 54px; border-radius: 999px; border: none; background: var(--green); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.85s linear infinite; display: inline-block; }
        @media (max-width: 700px) {
          .form-grid { grid-template-columns: 1fr; }
          .grid, .pricing-grid { grid-template-columns: 1fr; }
          .clients-layout, .client-meta-grid { grid-template-columns: 1fr; }
          .terminal-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
      `}</style>

export type MarketQuotesApi =
	| { ok: true; mode: 'demo'; quotes: []; fetchedAt: string; source: null }
	| {
			ok: true;
			mode: 'live';
			quotes: Array<{ symbol: string; open: number; close: number; date: string; time: string }>;
			fetchedAt: string;
			source: 'stooq_delayed';
	  }
	| { ok: false; mode: 'error'; quotes: []; fetchedAt: string; source: null; error: string };

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

export type DealRow = {
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

export type DealCategoryFilter = 'all' | DealRow['category'];
export type SearchableDeal = DealRow & { searchText: string };
export type WatchlistPanel = 'saved' | 'cabinet';

export type Lang = 'bg' | 'en';

export type View =
	| 'landing'
	| 'market'
	| 'assistant'
	| 'automation'
	| 'pricing'
	| 'register'
	| 'login'
	| 'company'
	| 'clients'
	| 'watchlist';

export type ClientProfile = {
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

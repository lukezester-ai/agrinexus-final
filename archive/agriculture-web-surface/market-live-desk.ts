import type { AppLocale } from "@/i18n/routing";
import { fetchAgriNews } from "./news-fetcher";

/** CBOT фючърси през Yahoo chart v8 (delayed, неофициално). */
const DESK_TICKERS = [
	{ sym: "WHEAT", yahoo: "ZW=F", name: "CBOT SRW wheat · front", kind: "grainCentsBu" as const },
	{ sym: "CORN", yahoo: "ZC=F", name: "CBOT corn · front", kind: "grainCentsBu" as const },
	{ sym: "SOY", yahoo: "ZS=F", name: "CBOT soybeans · front", kind: "grainCentsBu" as const },
	{ sym: "OIL", yahoo: "ZL=F", name: "CBOT soybean oil · front", kind: "usdTwo" as const },
];

export type LiveDeskRow = {
	sym: string;
	name: string;
	priceStr: string;
	deltaStr: string;
	up: boolean;
	spark: number[];
};

export type LiveDeskPayload = {
	rows: LiveDeskRow[];
	updatedAt: string;
	source: string;
	warning?: string;
};

type ChartJson = {
	chart?: {
		result?: {
			meta?: {
				regularMarketPrice?: number;
				currency?: string;
				regularMarketTime?: number;
				shortName?: string;
				symbol?: string;
			};
			indicators?: { quote?: { close?: (number | null)[] }[] };
		}[];
	};
};

function formatUsdGrainCentsPerBu(raw: number | null | undefined): string {
	if (raw == null || Number.isNaN(raw)) return "—";
	return `$${(raw / 100).toFixed(3)}/bu`;
}

function formatUsdTwo(raw: number | null | undefined): string {
	if (raw == null || Number.isNaN(raw)) return "—";
	return `$${raw.toFixed(2)}`;
}

function formatPrice(kind: "grainCentsBu" | "usdTwo", raw: number | null | undefined): string {
	return kind === "grainCentsBu" ? formatUsdGrainCentsPerBu(raw) : formatUsdTwo(raw);
}

function sparkFromCloses(closes: number[]): number[] {
	const tail = closes.filter((c) => c > 0).slice(-8);
	if (!tail.length) return [8, 8, 8, 8, 8, 8, 8, 8];
	const lo = Math.min(...tail);
	const hi = Math.max(...tail);
	const span = hi - lo || 1;
	return tail.map((c) => {
		const n = (c - lo) / span;
		return Math.round(6 + n * 12);
	});
}

async function fetchOneTicker(cfg: (typeof DESK_TICKERS)[number]): Promise<LiveDeskRow | null> {
	const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(cfg.yahoo)}?interval=1d&range=1mo`;
	const res = await fetch(url, {
		headers: { "User-Agent": "AgriNexus-MarketDesk/1.0 (+https://agrinexus.org)" },
		next: { revalidate: 180 },
	});
	if (!res.ok) return null;
	const json = (await res.json()) as ChartJson;
	const result = json.chart?.result?.[0];
	const meta = result?.meta;
	const closes =
		result?.indicators?.quote?.[0]?.close?.filter((v): v is number => typeof v === "number" && !Number.isNaN(v)) ?? [];
	const last = closes.length ? closes[closes.length - 1]! : meta?.regularMarketPrice ?? null;
	const prev = closes.length >= 2 ? closes[closes.length - 2]! : null;
	const changePct =
		prev != null && last != null && prev !== 0 ? Math.round(((last - prev) / prev) * 10000) / 100 : null;
	const up = changePct == null ? true : changePct >= 0;
	const priceStr = formatPrice(cfg.kind, last ?? meta?.regularMarketPrice);
	let deltaStr = "—";
	if (changePct != null) {
		const sign = changePct > 0 ? "+" : "";
		deltaStr = `${sign}${changePct.toFixed(2)}% 1d`;
	}
	return {
		sym: cfg.sym,
		name: cfg.name,
		priceStr,
		deltaStr,
		up,
		spark: sparkFromCloses(closes.length ? closes : last != null ? [last] : []),
	};
}

export async function fetchLiveDeskPayload(): Promise<LiveDeskPayload> {
	const settled = await Promise.all(DESK_TICKERS.map((c) => fetchOneTicker(c)));
	const rows = settled.filter((r): r is LiveDeskRow => r != null);
	const failed = settled.filter((r) => r == null).length;
	return {
		rows,
		updatedAt: new Date().toISOString(),
		source: "finance.yahoo.com (delayed, unofficial)",
		warning:
			failed > 0 && rows.length > 0
				? `${failed} ticker(s) failed to load.`
				: rows.length === 0
					? "Live quotes unavailable (network or Yahoo)."
					: undefined,
	};
}

function rowsToLlmBlock(rows: LiveDeskRow[]): string {
	const body = rows
		.map((r) => `${r.sym} (${r.name}): last ${r.priceStr}, session move ${r.deltaStr}`)
		.join("\n");
	return `=== DESK (delayed Yahoo, not investment advice) ===\n${body}\n=== END ===`;
}

export async function generateMarketDeskNote(locale: AppLocale, rows: LiveDeskRow[]): Promise<string | null> {
	const key = process.env.MISTRAL_API_KEY?.trim();
	if (!key || rows.length === 0) return null;
	const model = process.env.MISTRAL_MARKET_NOTE_MODEL?.trim() || "mistral-small-latest";
	const lang = locale === "bg" ? "Bulgarian" : "English";
	const system = `You are AgriNexus Market Desk copywriter.
Rules:
- Write exactly ONE short paragraph (3–5 sentences) in ${lang}.
- Audience: farmers; tone: clear, neutral, educational.
- Explain what the numbers roughly mean (front-month CBOT references), not personal trading instructions.
- Say explicitly that data is delayed Yahoo Finance, not real-time, and not financial advice.
- Do not invent prices; only use the figures in the user block.`;

	const user = rowsToLlmBlock(rows);

	const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${key}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model,
			temperature: 0.35,
			max_tokens: 280,
			messages: [
				{ role: "system", content: system },
				{ role: "user", content: user },
			],
		}),
		signal: AbortSignal.timeout(25_000),
	});

	if (!res.ok) {
		const t = await res.text().catch(() => "");
		console.warn("[market-desk-note] Mistral HTTP", res.status, t.slice(0, 200));
		return null;
	}
	const data = (await res.json()) as {
		choices?: { message?: { content?: string } }[];
	};
	const text = data.choices?.[0]?.message?.content?.trim();
	return text || null;
}

export async function loadMarketDesk(locale: AppLocale): Promise<LiveDeskPayload & { deskNote: string | null }> {
	const payload = await fetchLiveDeskPayload();
	let deskNote: string | null = null;
	if (payload.rows.length) {
		try {
			deskNote = await generateMarketDeskNote(locale, payload.rows);
		} catch (e) {
			console.warn("[market-desk-note]", e instanceof Error ? e.message : e);
			deskNote = null;
		}
	}
	return { ...payload, deskNote };
}

export type MarketSignal = {
	dir: "up" | "down" | "flat";
	text: string;
	sub: string;
	impact: string;
};

export async function generateLiveMarketSignals(locale: AppLocale): Promise<MarketSignal[]> {
	const key = process.env.MISTRAL_API_KEY?.trim();
	
	// Fallback/Mock data if no key is provided
	const fallbackBg: MarketSignal[] = [
		{ dir: "up", text: "Русия удължи квотите за износ на зърно", sub: "[NWS] 12 източника · публикувано 03:14 EET · корелация 0.74", impact: "+0.9%" },
		{ dir: "up", text: "Индексът за суша в US Plains се повиши с 12 пункта", sub: "[WTR] NOAA + Sentinel-2 · корелация 0.68", impact: "+0.7%" },
		{ dir: "up", text: "Еврото отслабна спрямо долара с 1.2% през нощта", sub: "[FIN] решение на ЕЦБ вече е в цената · корелация 0.55", impact: "+0.5%" },
		{ dir: "flat", text: "Докладът USDA WASDE излиза утре", sub: "[NWS] исторически: 60% от движенията идват след публикация", impact: "±0.0%" },
		{ dir: "down", text: "Аржентинската реколта е 3% над прогнозата", sub: "[SAT] Planet Labs imagery · корелация 0.62", impact: "−0.3%" },
	];
	
	const fallbackEn: MarketSignal[] = [
		{ dir: "up", text: "Russia extended grain export quotas", sub: "[NWS] 12 sources · published 03:14 EET · correlation 0.74", impact: "+0.9%" },
		{ dir: "up", text: "US Plains drought index +12 points", sub: "[WTR] NOAA + Sentinel-2 · correlation 0.68", impact: "+0.7%" },
		{ dir: "up", text: "EUR weaker vs USD by 1.2% overnight", sub: "[FIN] ECB rate decision priced in · correlation 0.55", impact: "+0.5%" },
		{ dir: "flat", text: "USDA WASDE report tomorrow", sub: "[NWS] historical: 60% of moves happen post-release", impact: "±0.0%" },
		{ dir: "down", text: "Argentine harvest 3% above forecast", sub: "[SAT] Planet Labs imagery · correlation 0.62", impact: "−0.3%" },
	];

	if (!key) return locale === "bg" ? fallbackBg : fallbackEn;

	try {
		const news = await fetchAgriNews();
		if (!news || news.length === 0) return locale === "bg" ? fallbackBg : fallbackEn;

		const model = process.env.MISTRAL_MARKET_NOTE_MODEL?.trim() || "mistral-small-latest";
		const lang = locale === "bg" ? "Bulgarian" : "English";
		
		const system = `You are AgriNexus Market AI. Analyze these real-time news headlines and generate exactly 5 market signals for agricultural commodities (wheat, corn, soy). 
Output format: JSON object with a single key "signals" containing an array of 5 objects:
{
  "signals": [
    {
      "dir": "up" | "down" | "flat",
      "text": "The main headline or event (in ${lang})",
      "sub": "[NWS] source name · brief logic",
      "impact": "e.g. +1.2% or -0.5% or ±0.0%"
    }
  ]
}
Make them realistic based on the provided news. ONLY return valid JSON.`;

		const user = "Latest News:\n" + news.map(n => `- ${n.title} (Source: ${n.source})`).join("\n");

		const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${key}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model,
				temperature: 0.3,
				response_format: { type: "json_object" },
				messages: [
					{ role: "system", content: system },
					{ role: "user", content: user },
				],
			}),
			signal: AbortSignal.timeout(25_000),
		});

		if (!res.ok) throw new Error(`Mistral error: ${res.statusText}`);

		const data = await res.json();
		const text = data.choices?.[0]?.message?.content?.trim();
		const parsed = JSON.parse(text);
		
		if (parsed.signals && Array.isArray(parsed.signals) && parsed.signals.length > 0) {
			return parsed.signals.slice(0, 5);
		}
		
		return locale === "bg" ? fallbackBg : fallbackEn;
	} catch (error) {
		console.error('[generateLiveMarketSignals]', error);
		return locale === "bg" ? fallbackBg : fallbackEn;
	}
}

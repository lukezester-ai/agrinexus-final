import type { AppLocale } from "@/i18n/routing";

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

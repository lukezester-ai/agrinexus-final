export const RADAR_ITEM_KINDS = [
	"candidate_match",
	"qualified_match",
	"pending_introduction",
	"relationship",
	"open_opportunity",
] as const;

export type RadarItemKind = (typeof RADAR_ITEM_KINDS)[number];

export type RadarSummary = {
	candidate_matches: number;
	qualified_matches: number;
	pending_introductions: number;
	active_relationships: number;
	open_opportunities: number;
};

export type RadarReason = {
	code: string;
	ok?: boolean;
	value?: number;
};

export type RadarItem = {
	item_kind: RadarItemKind;
	item_id: string;
	updated_at: string;
	score: number | string | null;
	status: string | null;
	safe_title: string | null;
	safe_summary: string | null;
	organization_a: string | null;
	organization_b: string | null;
	organization_a_name: string | null;
	organization_b_name: string | null;
	reasons?: RadarReason[];
};

export const EMPTY_RADAR_SUMMARY: RadarSummary = {
	candidate_matches: 0,
	qualified_matches: 0,
	pending_introductions: 0,
	active_relationships: 0,
	open_opportunities: 0,
};

export function parseRadarSummary(row: unknown): RadarSummary {
	if (!row || typeof row !== "object") return EMPTY_RADAR_SUMMARY;
	const r = row as Record<string, unknown>;
	const n = (value: unknown) => Number(value ?? 0) || 0;
	return {
		candidate_matches: n(r.candidate_matches),
		qualified_matches: n(r.qualified_matches),
		pending_introductions: n(r.pending_introductions),
		active_relationships: n(r.active_relationships),
		open_opportunities: n(r.open_opportunities),
	};
}

const MATCH_KINDS: RadarItemKind[] = ["candidate_match", "qualified_match", "pending_introduction"];

export function isRadarMatchKind(kind: RadarItemKind): boolean {
	return MATCH_KINDS.includes(kind);
}

export function parseMatchReasons(raw: unknown): RadarReason[] {
	if (!Array.isArray(raw)) return [];
	const out: RadarReason[] = [];
	for (const entry of raw) {
		if (!entry || typeof entry !== "object") continue;
		const row = entry as Record<string, unknown>;
		const code = typeof row.code === "string" ? row.code : "";
		if (!code) continue;
		const value = typeof row.value === "number" ? row.value : undefined;
		const ok = typeof row.ok === "boolean" ? row.ok : undefined;
		out.push({ code, ok, value });
	}
	return out;
}

export function matchPercent(score: number | string | null | undefined): number | null {
	if (score == null || score === "") return null;
	const n = Number(score);
	if (!Number.isFinite(n)) return null;
	const pct = n <= 1 ? Math.round(n * 100) : Math.round(n);
	return Math.min(100, Math.max(0, pct));
}

export function matchStrength(percent: number): "strong" | "good" | "possible" {
	if (percent >= 80) return "strong";
	if (percent >= 55) return "good";
	return "possible";
}

/** Positive matcher reasons only — display labels live in the UX layer. */
export function positiveReasonCodes(reasons: RadarReason[] | undefined): string[] {
	if (!reasons?.length) return [];
	const codes: string[] = [];
	for (const reason of reasons) {
		const positive = reason.ok === true || (typeof reason.value === "number" && reason.value > 0);
		if (!positive) continue;
		if (!codes.includes(reason.code)) codes.push(reason.code);
		if (codes.length === 3) break;
	}
	return codes;
}

export function attachMatchReasons(
	items: RadarItem[],
	reasonsByMatchId: Record<string, RadarReason[]>,
	introductionMatchIds: Record<string, string> = {},
): RadarItem[] {
	return items.map((item) => {
		const matchId =
			item.item_kind === "pending_introduction"
				? introductionMatchIds[item.item_id]
				: item.item_kind === "candidate_match" || item.item_kind === "qualified_match"
					? item.item_id
					: undefined;
		if (!matchId) return item;
		const reasons = reasonsByMatchId[matchId];
		return reasons?.length ? { ...item, reasons } : item;
	});
}

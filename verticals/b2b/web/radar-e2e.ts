import { Client } from "pg";
import {
	EMPTY_RADAR_SUMMARY,
	attachMatchReasons,
	parseMatchReasons,
	parseRadarSummary,
	type RadarItem,
	type RadarReason,
	type RadarSummary,
} from "@/lib/business-radar";

export const RADAR_E2E_ROLES = {
	A: "11111111-1111-1111-1111-111111111111",
	C: "33333333-3333-3333-3333-333333333333",
	D: "44444444-4444-4444-4444-444444444444",
	F: "66666666-6666-6666-6666-666666666666",
} as const;

export type RadarE2ERole = keyof typeof RADAR_E2E_ROLES;

const ALLOWED_RPC = new Set([
	"qualify_business_match",
	"request_business_match_introduction",
	"respond_business_match_introduction",
]);

export function isRadarE2EEnabled(): boolean {
	return Boolean(process.env.RADAR_E2E_DATABASE_URL && process.env.RADAR_E2E_SECRET);
}

export function assertRadarE2ESecret(secret: string | null | undefined): boolean {
	const expected = process.env.RADAR_E2E_SECRET;
	return Boolean(expected && secret && secret === expected);
}

export function parseRadarE2ERole(value: string | null | undefined): RadarE2ERole | null {
	if (!value) return null;
	const key = value.toUpperCase();
	return key in RADAR_E2E_ROLES ? (key as RadarE2ERole) : null;
}

async function withRadarUser<T>(role: RadarE2ERole, fn: (client: Client) => Promise<T>): Promise<T> {
	const connectionString = process.env.RADAR_E2E_DATABASE_URL;
	if (!connectionString) throw new Error("RADAR_E2E_DATABASE_URL is not set");
	const client = new Client({ connectionString });
	await client.connect();
	try {
		await client.query("BEGIN");
		await client.query("SELECT set_config('request.jwt.claims.sub', $1, true)", [RADAR_E2E_ROLES[role]]);
		const result = await fn(client);
		await client.query("COMMIT");
		return result;
	} catch (error) {
		try {
			await client.query("ROLLBACK");
		} catch {
			/* ignore */
		}
		throw error;
	} finally {
		await client.end();
	}
}

export async function loadRadarForRole(role: RadarE2ERole): Promise<{
	summary: RadarSummary;
	items: RadarItem[];
	introductionMatchIds: Record<string, string>;
}> {
	return withRadarUser(role, async (client) => {
		const summaryRes = await client.query("SELECT * FROM public.business_radar_summary()");
		const itemsRes = await client.query(
			"SELECT * FROM public.business_radar_items ORDER BY updated_at DESC",
		);
		const items = itemsRes.rows as unknown as RadarItem[];
		const pendingIds = items
			.filter((item) => item.item_kind === "pending_introduction")
			.map((item) => item.item_id);
		let introductionMatchIds: Record<string, string> = {};
		if (pendingIds.length > 0) {
			const intros = await client.query(
				"SELECT id, match_id FROM public.business_match_introductions WHERE id = ANY($1::uuid[])",
				[pendingIds],
			);
			introductionMatchIds = Object.fromEntries(
				intros.rows.map((row) => [String(row.id), String(row.match_id)]),
			);
		}
		const matchIds = [
			...items
				.filter((item) => item.item_kind === "candidate_match" || item.item_kind === "qualified_match")
				.map((item) => item.item_id),
			...Object.values(introductionMatchIds),
		];
		let reasonsByMatchId: Record<string, RadarReason[]> = {};
		if (matchIds.length > 0) {
			const reasonRes = await client.query(
				"SELECT id, reasons FROM public.business_matches WHERE id = ANY($1::uuid[])",
				[matchIds],
			);
			reasonsByMatchId = Object.fromEntries(
				reasonRes.rows.map((row) => [String(row.id), parseMatchReasons(row.reasons)]),
			);
		}
		return {
			summary: parseRadarSummary(summaryRes.rows[0] ?? EMPTY_RADAR_SUMMARY),
			items: attachMatchReasons(items, reasonsByMatchId, introductionMatchIds),
			introductionMatchIds,
		};
	});
}

export async function runRadarDomainAction(
	role: RadarE2ERole,
	fn: string,
	args: Record<string, unknown>,
): Promise<void> {
	if (!ALLOWED_RPC.has(fn)) throw new Error("rpc not allowed");
	const matchId = String(args.p_match_id ?? "");
	if (!matchId) throw new Error("p_match_id required");
	await withRadarUser(role, async (client) => {
		if (fn === "qualify_business_match") {
			await client.query("SELECT public.qualify_business_match($1::uuid)", [matchId]);
			return;
		}
		if (fn === "request_business_match_introduction") {
			await client.query("SELECT public.request_business_match_introduction($1::uuid, $2::text)", [
				matchId,
				String(args.p_note ?? ""),
			]);
			return;
		}
		await client.query(
			"SELECT public.respond_business_match_introduction($1::uuid, $2::boolean, $3::text)",
			[matchId, Boolean(args.p_accept), String(args.p_note ?? "")],
		);
	});
}

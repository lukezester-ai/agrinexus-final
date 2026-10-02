import { FINANCE_CATALOG } from "./finance-catalog";

export const LIVE_EXECUTION = "BLOCKED" as const;

export class FinanceAllowlistError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "FinanceAllowlistError";
	}
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OBSERVATIONS = ["accepted", "rejected", "filled", "partial", "unknown", "timeout", "missing", "invalid"] as const;

type FieldKind = "uuid" | "text" | "json" | "timestamptz" | "observation" | "limit";

type Field = { name: string; kind: FieldKind };

export type FinanceOperation = {
	name: string;
	surface: "intelligence" | "copilot" | "governance" | "safety";
	group: "read" | "create" | "validate" | "approve" | "run" | "record";
	sql: string;
	fields: Field[];
};

const EMPTY = "'{}'::jsonb";

export const FINANCE_OPERATIONS: FinanceOperation[] = [
	{ name: "read_instruments", surface: "intelligence", group: "read", sql: "SELECT id, organization_id, symbol, name FROM public.finance_instruments ORDER BY symbol", fields: [] },
	{ name: "read_bars", surface: "intelligence", group: "read", sql: "SELECT id, instrument_id, bar_index, bar_time, close FROM public.finance_market_bars WHERE instrument_id = $1 ORDER BY bar_index", fields: [{ name: "instrument_id", kind: "uuid" }] },
	{ name: "read_screeners", surface: "intelligence", group: "read", sql: "SELECT id, organization_id, name FROM public.finance_screeners ORDER BY name", fields: [] },
	{ name: "read_strategies", surface: "intelligence", group: "read", sql: "SELECT id, organization_id, instrument_id, name FROM public.finance_strategies ORDER BY name", fields: [] },
	{ name: "read_books", surface: "intelligence", group: "read", sql: "SELECT id, organization_id, strategy_id, market_value, result_digest FROM public.finance_spec_books", fields: [] },
	{ name: "read_performance", surface: "intelligence", group: "read", sql: "SELECT book_id, organization_id, trade_count, win_count, loss_count, win_rate, avg_trade, gross_profit, gross_loss, profit_factor, closed_pnl, paper_pnl, ending_equity, total_return, max_drawdown, peak_equity, max_drawdown_bars FROM public.finance_performance_stats", fields: [] },
	{ name: "read_policies", surface: "governance", group: "read", sql: "SELECT id, organization_id, policy_digest FROM public.finance_risk_policies", fields: [] },
	{ name: "read_evaluations", surface: "governance", group: "read", sql: "SELECT id, organization_id, policy_id, book_id, accepted, evaluation_digest FROM public.finance_risk_evaluations", fields: [] },
	{ name: "read_approvals", surface: "governance", group: "read", sql: "SELECT id, organization_id, book_id, specification_digest, strategy_digest, backtest_digest, risk_digest FROM public.finance_strategy_approvals", fields: [] },
	{ name: "read_dispatches", surface: "safety", group: "read", sql: "SELECT id, organization_id, contract_id, admitted, sent, live_permitted FROM public.finance_production_dispatches", fields: [] },
	{ name: "read_observed_results", surface: "safety", group: "read", sql: "SELECT id, organization_id, contract_id, external_result, success, admitted, sent, live_permitted FROM public.finance_observed_production_results", fields: [] },
	{ name: "read_limits", surface: "safety", group: "read", sql: "SELECT id, organization_id, document FROM public.finance_production_limit_documents", fields: [] },
	{ name: "read_kill_switches", surface: "safety", group: "read", sql: "SELECT id, organization_id, engaged FROM public.finance_production_kill_switches", fields: [] },
	{ name: "create_instrument", surface: "intelligence", group: "create", sql: "SELECT public.finance_create_instrument($1, $2, $3)", fields: [{ name: "organization_id", kind: "uuid" }, { name: "symbol", kind: "text" }, { name: "name", kind: "text" }] },
	{ name: "replace_market_bars", surface: "intelligence", group: "create", sql: "SELECT public.finance_replace_market_bars($1, $2::jsonb)", fields: [{ name: "instrument_id", kind: "uuid" }, { name: "bars", kind: "json" }] },
	{ name: "create_screener", surface: "intelligence", group: "create", sql: "SELECT public.finance_create_screener($1, $2, $3::jsonb)", fields: [{ name: "organization_id", kind: "uuid" }, { name: "name", kind: "text" }, { name: "spec", kind: "json" }] },
	{ name: "run_screener", surface: "intelligence", group: "run", sql: "SELECT public.finance_run_screener($1)", fields: [{ name: "screener_id", kind: "uuid" }] },
	{ name: "capture_snapshot", surface: "intelligence", group: "run", sql: "SELECT public.finance_capture_snapshot($1, $2::timestamptz)", fields: [{ name: "screener_id", kind: "uuid" }, { name: "as_of", kind: "timestamptz" }] },
	{ name: "compile_strategy", surface: "copilot", group: "validate", sql: "SELECT spec, digest FROM public.finance_compile_strategy_candidate($1::jsonb)", fields: [{ name: "candidate", kind: "json" }] },
	{ name: "create_strategy", surface: "intelligence", group: "create", sql: "SELECT public.finance_create_strategy($1, $2, $3::jsonb)", fields: [{ name: "instrument_id", kind: "uuid" }, { name: "name", kind: "text" }, { name: "spec", kind: "json" }] },
	{ name: "validate_strategy", surface: "intelligence", group: "validate", sql: "SELECT public.finance_validate_strategy($1)", fields: [{ name: "strategy_id", kind: "uuid" }] },
	{ name: "run_snapshot_strategy", surface: "intelligence", group: "run", sql: "SELECT public.finance_run_snapshot_strategy($1, $2)", fields: [{ name: "snapshot_id", kind: "uuid" }, { name: "strategy_id", kind: "uuid" }] },
	{ name: "run_spec_backtest", surface: "intelligence", group: "run", sql: "SELECT public.finance_run_spec_backtest($1)", fields: [{ name: "strategy_id", kind: "uuid" }] },
	{ name: "apply_paper_book", surface: "intelligence", group: "run", sql: "SELECT public.finance_apply_paper_book($1, $2)", fields: [{ name: "portfolio_id", kind: "uuid" }, { name: "book_id", kind: "uuid" }] },
	{ name: "create_risk_policy", surface: "governance", group: "create", sql: "SELECT public.finance_create_risk_policy($1, $2::jsonb)", fields: [{ name: "organization_id", kind: "uuid" }, { name: "policy", kind: "json" }] },
	{ name: "replace_risk_policy", surface: "governance", group: "create", sql: "SELECT public.finance_replace_risk_policy($1, $2::jsonb)", fields: [{ name: "policy_id", kind: "uuid" }, { name: "policy", kind: "json" }] },
	{ name: "evaluate_risk_policy", surface: "governance", group: "run", sql: "SELECT public.finance_evaluate_risk_policy($1, $2)", fields: [{ name: "policy_id", kind: "uuid" }, { name: "book_id", kind: "uuid" }] },
	{ name: "approve_strategy", surface: "governance", group: "approve", sql: "SELECT public.finance_approve_strategy_result($1)", fields: [{ name: "book_id", kind: "uuid" }] },
	{ name: "create_order_intent", surface: "safety", group: "create", sql: `SELECT public.finance_create_order_intent($1, ${EMPTY})`, fields: [{ name: "approval_id", kind: "uuid" }] },
	{ name: "recheck_order_intent", surface: "safety", group: "run", sql: "SELECT public.finance_recheck_order_intent($1)", fields: [{ name: "intent_id", kind: "uuid" }] },
	{ name: "authorize_order_intent", surface: "safety", group: "approve", sql: `SELECT public.finance_authorize_order_intent($1, ${EMPTY})`, fields: [{ name: "intent_id", kind: "uuid" }] },
	{ name: "create_execution_contract", surface: "safety", group: "create", sql: `SELECT public.finance_create_execution_contract($1, ${EMPTY})`, fields: [{ name: "authorization_id", kind: "uuid" }] },
	{ name: "record_production_authorization", surface: "safety", group: "record", sql: `SELECT public.finance_record_production_authorization($1, ${EMPTY})`, fields: [{ name: "contract_id", kind: "uuid" }] },
	{ name: "cancel_production_authorization", surface: "safety", group: "approve", sql: `SELECT public.finance_cancel_production_authorization($1, ${EMPTY})`, fields: [{ name: "contract_id", kind: "uuid" }] },
	{ name: "pass_production_safety", surface: "safety", group: "record", sql: `SELECT public.finance_pass_production_safety($1, ${EMPTY})`, fields: [{ name: "contract_id", kind: "uuid" }] },
	{ name: "record_production_dispatch", surface: "safety", group: "record", sql: `SELECT public.finance_record_production_dispatch($1, ${EMPTY})`, fields: [{ name: "contract_id", kind: "uuid" }] },
	{ name: "record_observed_production_result", surface: "safety", group: "record", sql: `SELECT public.finance_record_observed_production_result($1, $2, ${EMPTY})`, fields: [{ name: "contract_id", kind: "uuid" }, { name: "observation", kind: "observation" }] },
	{ name: "reconcile_observed_production_result", surface: "safety", group: "record", sql: `SELECT public.finance_reconcile_observed_production_result($1, ${EMPTY})`, fields: [{ name: "contract_id", kind: "uuid" }] },
	{ name: "set_production_limit", surface: "safety", group: "record", sql: "SELECT public.finance_set_production_limit($1, $2::jsonb)", fields: [{ name: "organization_id", kind: "uuid" }, { name: "limit", kind: "limit" }] },
	{ name: "engage_kill_switch", surface: "safety", group: "record", sql: `SELECT public.finance_engage_production_kill_switch($1, ${EMPTY})`, fields: [{ name: "contract_id", kind: "uuid" }] },
];

const FORBIDDEN_SQL = [
	"finance_lock_production_limit",
	"finance_run_compiled_strategy",
	"finance_execute_strategy",
	"finance_begin_sandbox_dispatch",
	"finance_finish_sandbox_dispatch",
	"finance_sandbox_protocol",
	"finance_reconcile_sandbox_execution",
	"finance_live_boundary",
	"finance_production_execution",
	"finance_match_order_authorization",
	"finance_match_production_authorization",
	"finance_register_data_provider",
	"finance_ingest_market_bars",
	"finance_register_instrument",
	"finance_record_production_external_result",
	"finance_reconcile_production_result",
	"finance_risk_policy_document",
	"disengage",
	"reactivate",
];

export function assertAllowlistClosed(): void {
	const names = FINANCE_OPERATIONS.map((operation) => operation.name);
	const catalogNames = FINANCE_CATALOG.map((operation) => operation.name);
	if (names.join("\n") !== catalogNames.join("\n")) {
		throw new FinanceAllowlistError("operation is not allowed");
	}
	for (const operation of FINANCE_OPERATIONS) {
		const catalog = FINANCE_CATALOG.find((item) => item.name === operation.name);
		const fields = operation.fields.map((field) => field.name);
		if (!catalog || fields.join("\n") !== catalog.fields.join("\n")) {
			throw new FinanceAllowlistError("operation is not allowed");
		}
	}
	for (const operation of FINANCE_OPERATIONS) {
		for (const forbidden of FORBIDDEN_SQL) {
			if (operation.sql.includes(forbidden)) {
				throw new FinanceAllowlistError("operation is not allowed");
			}
		}
	}
}

export function prepareFinanceCall(operation: string, input: unknown): { sql: string; params: unknown[] } {
	assertAllowlistClosed();
	const found = FINANCE_OPERATIONS.find((item) => item.name === operation);
	if (!found) throw new FinanceAllowlistError("operation is not allowed");
	if (input === null || typeof input !== "object" || Array.isArray(input)) {
		throw new FinanceAllowlistError("field is not allowed");
	}
	const record = input as Record<string, unknown>;
	const known = new Set(found.fields.map((field) => field.name));
	for (const key of Object.keys(record)) {
		if (!known.has(key)) throw new FinanceAllowlistError("field is not allowed");
	}
	const params = found.fields.map((field) => readField(field, record[field.name]));
	return { sql: found.sql, params };
}

function readField(field: Field, value: unknown): unknown {
	if (field.kind === "uuid") {
		if (typeof value !== "string" || !UUID.test(value)) throw new FinanceAllowlistError("field is not allowed");
		return value;
	}
	if (field.kind === "text") {
		if (typeof value !== "string" || value.trim() === "") throw new FinanceAllowlistError("field is not allowed");
		return value;
	}
	if (field.kind === "timestamptz") {
		if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new FinanceAllowlistError("field is not allowed");
		return value;
	}
	if (field.kind === "observation") {
		if (typeof value !== "string" || !OBSERVATIONS.includes(value as (typeof OBSERVATIONS)[number])) {
			throw new FinanceAllowlistError("field is not allowed");
		}
		return value;
	}
	if (field.kind === "json") {
		if (value === null || typeof value !== "object") throw new FinanceAllowlistError("field is not allowed");
		return JSON.stringify(value);
	}
	if (value === null || typeof value !== "object" || Array.isArray(value)) throw new FinanceAllowlistError("field is not allowed");
	const limit = value as Record<string, unknown>;
	const keys = Object.keys(limit).sort();
	if (keys.join(",") !== "exposure_limit,order_limit") throw new FinanceAllowlistError("field is not allowed");
	if (!isNonNegativeInteger(limit.order_limit) || !isNonNegativeNumber(limit.exposure_limit)) {
		throw new FinanceAllowlistError("field is not allowed");
	}
	return JSON.stringify({ exposure_limit: limit.exposure_limit, order_limit: limit.order_limit });
}

function isNonNegativeNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isNonNegativeInteger(value: unknown): value is number {
	return isNonNegativeNumber(value) && Number.isInteger(value);
}

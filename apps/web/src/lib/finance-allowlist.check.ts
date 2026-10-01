import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FinanceAllowlistError, FINANCE_OPERATIONS, prepareFinanceCall } from "./finance-allowlist";

const forbidden = [
	"finance_lock_production_limit",
	"finance_begin_sandbox_dispatch",
	"finance_live_boundary",
	"finance_production_execution",
	"finance_register_data_provider",
	"disengage",
	"reactivate",
];
for (const operation of FINANCE_OPERATIONS) {
	for (const name of forbidden) assert.equal(operation.sql.includes(name), false, operation.name);
}
const dispatch = prepareFinanceCall("record_production_dispatch", { contract_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" });
assert.match(dispatch.sql, /'{}'::jsonb/);
assert.equal(dispatch.params.length, 1);
assert.throws(
	() => prepareFinanceCall("record_production_dispatch", { contract_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", sent: false }),
	FinanceAllowlistError,
);
assert.throws(() => prepareFinanceCall("finance_begin_sandbox_dispatch", {}), FinanceAllowlistError);
assert.throws(
	() => prepareFinanceCall("engage_kill_switch", { contract_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", disengage: true }),
	FinanceAllowlistError,
);
const limit = prepareFinanceCall("set_production_limit", {
	organization_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
	limit: { order_limit: 1, exposure_limit: 10000 },
});
assert.deepEqual(JSON.parse(String(limit.params[1])), { exposure_limit: 10000, order_limit: 1 });
const desk = readFileSync(new URL("../components/finance/FinanceDesk.tsx", import.meta.url), "utf8");
assert.equal(desk.includes("finance-allowlist"), false);
assert.equal(desk.includes("supabase.rpc"), false);
assert.equal(desk.includes("Execute Trade"), false);
assert.match(desk, /LIVE EXECUTION: BLOCKED/);
const db = readFileSync(new URL("./finance-db.ts", import.meta.url), "utf8");
assert.match(db, /request\.jwt\.claim\.sub/);
assert.equal(db.includes("SUPABASE_SERVICE_ROLE_KEY"), false);
console.log("finance allowlist closed");

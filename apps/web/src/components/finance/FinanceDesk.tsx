"use client";

import { useState } from "react";
import {
	OBSERVATION_LABELS,
	barsFromCloses,
	closesFromText,
	describeStrategy,
	riskPolicy,
	sampleCloses,
	screenSpec,
	strategySpec,
} from "@/components/finance/finance-flow";

type Row = Record<string, unknown>;

async function governed(operation: string, input: Record<string, unknown>): Promise<Row[]> {
	const response = await fetch("/api/finance", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ operation, input }),
	});
	const body = (await response.json()) as { error?: string; rows?: Row[] };
	if (!response.ok) throw new Error(body.error || "This step did not complete.");
	return body.rows ?? [];
}

function resultId(rows: Row[], column: string): string {
	const value = rows[0]?.[column];
	if (typeof value !== "string" || value === "") throw new Error("This step did not return a result.");
	return value;
}

function Primary({ children, disabled, onClick }: { children: string; disabled?: boolean; onClick: () => void }) {
	return (
		<button type="button" disabled={disabled} onClick={onClick} className="rounded-full bg-ink px-4 py-2 text-[13px] text-white disabled:opacity-50">
			{children}
		</button>
	);
}

function HumanAct({ children, disabled, onClick }: { children: string; disabled?: boolean; onClick: () => void }) {
	return (
		<button type="button" disabled={disabled} onClick={onClick} className="rounded-full border-2 border-ink px-4 py-2 text-[13px] text-ink disabled:opacity-50">
			{children}
		</button>
	);
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<section className="mb-8">
			<h2 className="mb-3 text-sm font-medium text-ink">{title}</h2>
			<div className="space-y-4 rounded-2xl border border-ink/10 bg-white/80 p-4">{children}</div>
		</section>
	);
}

function Note({ children }: { children: React.ReactNode }) {
	return <p className="text-[13px] leading-6 text-ink/75">{children}</p>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<label className="block text-[12px] text-ink/70">
			{label}
			<div className="mt-1">{children}</div>
		</label>
	);
}

const inputClass = "w-full rounded-xl border border-ink/10 px-3 py-2 text-[13px] text-ink";

export function FinanceDesk({ organizationId, organizationError }: { organizationId: string; organizationError: string | null }) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [symbol, setSymbol] = useState("");
	const [instrumentName, setInstrumentName] = useState("");
	const [instrumentId, setInstrumentId] = useState("");
	const [closes, setCloses] = useState(sampleCloses());
	const [barsSaved, setBarsSaved] = useState(0);
	const [screenName, setScreenName] = useState("Close above threshold");
	const [minimumClose, setMinimumClose] = useState("100");
	const [screenerId, setScreenerId] = useState("");
	const [screenRan, setScreenRan] = useState(false);
	const [snapshotId, setSnapshotId] = useState("");
	const [strategyName, setStrategyName] = useState("Average cross");
	const [fast, setFast] = useState("20");
	const [slow, setSlow] = useState("50");
	const [rsiLength, setRsiLength] = useState("14");
	const [rsiLevel, setRsiLevel] = useState("70");
	const [canonical, setCanonical] = useState("");
	const [digest, setDigest] = useState("");
	const [compiledSpec, setCompiledSpec] = useState<unknown>(null);
	const [strategyId, setStrategyId] = useState("");
	const [validated, setValidated] = useState(false);
	const [bookId, setBookId] = useState("");
	const [paper, setPaper] = useState("");
	const [analytics, setAnalytics] = useState<Array<{ key: string; line: string }>>([]);
	const [allowedInstruments, setAllowedInstruments] = useState("");
	const [allowedStrategies, setAllowedStrategies] = useState("");
	const [forbidLong, setForbidLong] = useState(false);
	const [maxPositions, setMaxPositions] = useState("5");
	const [maxDrawdown, setMaxDrawdown] = useState("1");
	const [maxExposure, setMaxExposure] = useState("1000000");
	const [maxRisk, setMaxRisk] = useState("1");
	const [policyId, setPolicyId] = useState("");
	const [evaluation, setEvaluation] = useState("");
	const [evaluationAccepted, setEvaluationAccepted] = useState<boolean | null>(null);
	const [approvalId, setApprovalId] = useState("");
	const [approvalDigest, setApprovalDigest] = useState("");
	const [intentId, setIntentId] = useState("");
	const [rechecked, setRechecked] = useState(false);
	const [authorizationId, setAuthorizationId] = useState("");
	const [contractId, setContractId] = useState("");
	const [productionAuthorizationId, setProductionAuthorizationId] = useState("");
	const [safetyPassed, setSafetyPassed] = useState(false);
	const [ceiling, setCeiling] = useState<"pending" | "saved" | "default">("pending");
	const [orderLimit, setOrderLimit] = useState("1");
	const [exposureLimit, setExposureLimit] = useState("10000");
	const [dispatchId, setDispatchId] = useState("");
	const [observation, setObservation] = useState<(typeof OBSERVATION_LABELS)[number][0]>("unknown");
	const [observed, setObserved] = useState(false);
	const [reconciled, setReconciled] = useState(false);
	const [cancelled, setCancelled] = useState(false);
	const [killEngaged, setKillEngaged] = useState(false);

	async function run(work: () => Promise<void>) {
		setBusy(true);
		setError("");
		try {
			await work();
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "This step did not complete.");
		} finally {
			setBusy(false);
		}
	}

	const ready = Boolean(organizationId) && !organizationError;

	return (
		<main className="mx-auto max-w-3xl px-6 py-10">
			<p className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink/50">Finance Intelligence</p>
			<h1 className="mb-4 font-serif text-3xl text-ink">Decision infrastructure</h1>
			<p className="mb-8 rounded-2xl border border-ink/10 bg-white/80 px-4 py-3 text-sm text-ink">LIVE EXECUTION: BLOCKED</p>
			{organizationError ? <p className="mb-6 text-sm text-ink">{organizationError}</p> : null}
			{error ? <p className="mb-6 text-sm text-ink">{error}</p> : null}

			<Card title="Finance Intelligence">
				<Note>Market data, then a screen, then a snapshot. The strategy itself is compiled in the next section.</Note>
				{instrumentId ? (
					<Note>Instrument {symbol} is saved.</Note>
				) : (
					<div className="grid gap-3 sm:grid-cols-2">
						<Field label="Symbol">
							<input className={inputClass} value={symbol} onChange={(event) => setSymbol(event.target.value)} />
						</Field>
						<Field label="Name">
							<input className={inputClass} value={instrumentName} onChange={(event) => setInstrumentName(event.target.value)} />
						</Field>
						<Primary
							disabled={!ready || busy}
							onClick={() =>
								run(async () => {
									const rows = await governed("create_instrument", {
										organization_id: organizationId,
										symbol,
										name: instrumentName,
									});
									setInstrumentId(resultId(rows, "finance_create_instrument"));
									setAllowedInstruments(symbol);
								})
							}
						>
							Save instrument
						</Primary>
					</div>
				)}
				{instrumentId && barsSaved === 0 ? (
					<div className="space-y-3">
						<Field label="Closing prices, one per line">
							<textarea className={inputClass} rows={6} value={closes} onChange={(event) => setCloses(event.target.value)} />
						</Field>
						<Primary
							disabled={busy}
							onClick={() =>
								run(async () => {
									const bars = barsFromCloses(closesFromText(closes));
									const rows = await governed("replace_market_bars", { instrument_id: instrumentId, bars });
									const count = Number(rows[0]?.finance_replace_market_bars);
									setBarsSaved(Number.isFinite(count) ? count : bars.length);
								})
							}
						>
							Save market data
						</Primary>
					</div>
				) : null}
				{barsSaved > 0 ? <Note>{barsSaved} closes are saved.</Note> : null}
				{barsSaved > 0 && !screenerId ? (
					<div className="grid gap-3 sm:grid-cols-2">
						<Field label="Screen name">
							<input className={inputClass} value={screenName} onChange={(event) => setScreenName(event.target.value)} />
						</Field>
						<Field label="Close above">
							<input className={inputClass} value={minimumClose} onChange={(event) => setMinimumClose(event.target.value)} />
						</Field>
						<Primary
							disabled={busy}
							onClick={() =>
								run(async () => {
									const rows = await governed("create_screener", {
										organization_id: organizationId,
										name: screenName,
										spec: screenSpec(Number(minimumClose)),
									});
									setScreenerId(resultId(rows, "finance_create_screener"));
								})
							}
						>
							Save screen
						</Primary>
					</div>
				) : null}
				{screenerId && !screenRan ? (
					<Primary
						disabled={busy}
						onClick={() =>
							run(async () => {
								await governed("run_screener", { screener_id: screenerId });
								setScreenRan(true);
							})
						}
					>
						Run screen
					</Primary>
				) : null}
				{screenRan && !snapshotId ? (
					<Primary
						disabled={busy}
						onClick={() =>
							run(async () => {
								const rows = await governed("capture_snapshot", {
									screener_id: screenerId,
									as_of: new Date().toISOString(),
								});
								setSnapshotId(resultId(rows, "finance_capture_snapshot"));
							})
						}
					>
						Capture snapshot
					</Primary>
				) : null}
				{snapshotId ? <Note>Snapshot captured for {screenName}.</Note> : null}
			</Card>

			<Card title="AI Strategy Copilot">
				<Note>The copilot compiles a candidate. It cannot approve the result or send an order.</Note>
				{!instrumentId ? <Note>Save an instrument before describing a strategy.</Note> : null}
				{instrumentId && !compiledSpec ? (
					<div className="grid gap-3 sm:grid-cols-2">
						<Field label="Strategy name">
							<input className={inputClass} value={strategyName} onChange={(event) => setStrategyName(event.target.value)} />
						</Field>
						<Field label="Fast average, days">
							<input className={inputClass} value={fast} onChange={(event) => setFast(event.target.value)} />
						</Field>
						<Field label="Slow average, days">
							<input className={inputClass} value={slow} onChange={(event) => setSlow(event.target.value)} />
						</Field>
						<Field label="RSI length">
							<input className={inputClass} value={rsiLength} onChange={(event) => setRsiLength(event.target.value)} />
						</Field>
						<Field label="RSI below">
							<input className={inputClass} value={rsiLevel} onChange={(event) => setRsiLevel(event.target.value)} />
						</Field>
						<Primary
							disabled={busy}
							onClick={() =>
								run(async () => {
									const numbers = {
										fast: Number(fast),
										slow: Number(slow),
										rsiLength: Number(rsiLength),
										rsiLevel: Number(rsiLevel),
									};
									const candidate = strategySpec(numbers.fast, numbers.slow, numbers.rsiLength, numbers.rsiLevel);
									const rows = await governed("compile_strategy", { candidate });
									const compiled = rows[0]?.spec;
									const nextDigest = rows[0]?.digest;
									if (!compiled || typeof nextDigest !== "string") throw new Error("The candidate did not compile.");
									setCompiledSpec(compiled);
									setDigest(nextDigest);
									setCanonical(describeStrategy(numbers.fast, numbers.slow, numbers.rsiLength, numbers.rsiLevel));
									setAllowedStrategies(strategyName);
								})
							}
						>
							Compile candidate
						</Primary>
					</div>
				) : null}
				{canonical ? (
					<div className="space-y-2">
						<Note>{canonical}</Note>
						<p className="font-mono text-[12px] text-ink">Digest {digest}</p>
					</div>
				) : null}
				{compiledSpec && !strategyId ? (
					<Primary
						disabled={busy || !instrumentId}
						onClick={() =>
							run(async () => {
								const rows = await governed("create_strategy", {
									instrument_id: instrumentId,
									name: strategyName,
									spec: compiledSpec,
								});
								setStrategyId(resultId(rows, "finance_create_strategy"));
							})
						}
					>
						Create strategy
					</Primary>
				) : null}
				{strategyId ? <Note>{strategyName} is saved for {symbol}.</Note> : null}
			</Card>

			<Card title="Backtest and paper result">
				{!strategyId ? <Note>Create the strategy before strategy research.</Note> : null}
				{strategyId && !validated ? (
					<Primary
						disabled={busy}
						onClick={() =>
							run(async () => {
								await governed("validate_strategy", { strategy_id: strategyId });
								setValidated(true);
							})
						}
					>
						Check strategy
					</Primary>
				) : null}
				{validated && !bookId && !snapshotId ? <Note>Capture a snapshot before strategy research.</Note> : null}
				{validated && !bookId && snapshotId ? (
					<Primary
						disabled={busy}
						onClick={() =>
							run(async () => {
								await governed("run_snapshot_strategy", { snapshot_id: snapshotId, strategy_id: strategyId });
								const books = await governed("read_books", {});
								const book = books.find((row) => row.strategy_id === strategyId);
								if (!book || typeof book.id !== "string" || book.id === "") throw new Error("This step did not return a result.");
								setBookId(book.id);
								const value = book.market_value;
								const bookDigest = book.result_digest;
								setPaper(
									`Paper market value ${value ?? "recorded"}. Result digest ${typeof bookDigest === "string" ? bookDigest : "recorded"}.`,
								);
							})
						}
					>
						Run strategy research
					</Primary>
				) : null}
				{paper ? <Note>{paper}</Note> : null}
			</Card>

			<Card title="Finance Analytics">
				<Note>Recorded paper figures for this organization. Nothing here sends an order.</Note>
				<Primary
					disabled={!ready || busy}
					onClick={() =>
						run(async () => {
							const [stats, books, strategies, instruments, evaluations] = await Promise.all([
								governed("read_performance", {}),
								governed("read_books", {}),
								governed("read_strategies", {}),
								governed("read_instruments", {}),
								governed("read_evaluations", {}),
							]);
							const lines = stats
								.map((stat) => {
									const book = books.find((row) => row.id === stat.book_id);
									const strategy = strategies.find((row) => row.id === book?.strategy_id);
									const instrument = instruments.find((row) => row.id === strategy?.instrument_id);
									const evaluation = evaluations.find((row) => row.book_id === stat.book_id);
									const name = typeof strategy?.name === "string" ? strategy.name : "Recorded strategy";
									const symbol = typeof instrument?.symbol === "string" ? instrument.symbol : "Recorded instrument";
									const factor = stat.profit_factor == null ? "empty" : String(stat.profit_factor);
									const evaluationText =
										evaluation?.accepted === true
											? `accepted. Digest ${String(evaluation.evaluation_digest ?? "")}`
											: evaluation
												? `withheld. Digest ${String(evaluation.evaluation_digest ?? "")}`
												: "withheld";
									const strategyId = typeof book?.strategy_id === "string" ? book.strategy_id : String(stat.book_id ?? "");
									return {
										key: strategyId,
										line: [
											`${name} · ${symbol}`,
											`Market value ${String(book?.market_value ?? "")}. Paper P&L ${String(stat.paper_pnl ?? "")}. Drawdown ${String(stat.max_drawdown ?? "")}.`,
											`Ending equity ${String(stat.ending_equity ?? "")}. Return ${String(stat.total_return ?? "")}. Trades ${String(stat.trade_count ?? "")}. Win rate ${String(stat.win_rate ?? "")}. Profit factor ${factor}.`,
											`Result digest ${String(book?.result_digest ?? "")}. Evaluation ${evaluationText}.`,
										].join(" "),
									};
								})
								.sort((left, right) => left.key.localeCompare(right.key));
							setAnalytics(lines);
						})
					}
				>
					Show recorded analytics
				</Primary>
				{analytics.length === 0 ? <Note>Recorded analytics appear here after they are loaded.</Note> : analytics.map((item) => <Note key={item.key}>{item.line}</Note>)}
			</Card>

			<Card title="Risk & Governance">
				{!bookId ? <Note>A paper result is required before risk review.</Note> : null}
				{bookId && !policyId ? (
					<div className="grid gap-3">
						<Field label="Allowed instruments">
							<input className={inputClass} value={allowedInstruments} onChange={(event) => setAllowedInstruments(event.target.value)} />
						</Field>
						<Field label="Allowed strategies">
							<input className={inputClass} value={allowedStrategies} onChange={(event) => setAllowedStrategies(event.target.value)} />
						</Field>
						<label className="flex items-center gap-2 text-[13px] text-ink">
							<input type="checkbox" checked={forbidLong} onChange={(event) => setForbidLong(event.target.checked)} />
							Forbid long positions
						</label>
						<div className="grid gap-3 sm:grid-cols-2">
							<Field label="Max concurrent positions">
								<input className={inputClass} value={maxPositions} onChange={(event) => setMaxPositions(event.target.value)} />
							</Field>
							<Field label="Max drawdown">
								<input className={inputClass} value={maxDrawdown} onChange={(event) => setMaxDrawdown(event.target.value)} />
							</Field>
							<Field label="Max exposure">
								<input className={inputClass} value={maxExposure} onChange={(event) => setMaxExposure(event.target.value)} />
							</Field>
							<Field label="Max risk per position">
								<input className={inputClass} value={maxRisk} onChange={(event) => setMaxRisk(event.target.value)} />
							</Field>
						</div>
						<Primary
							disabled={busy}
							onClick={() =>
								run(async () => {
									const rows = await governed("create_risk_policy", {
										organization_id: organizationId,
										policy: riskPolicy({
											instruments: allowedInstruments,
											strategies: allowedStrategies,
											forbidLong,
											maxPositions: Number(maxPositions),
											maxDrawdown: Number(maxDrawdown),
											maxExposure: Number(maxExposure),
											maxRisk: Number(maxRisk),
										}),
									});
									setPolicyId(resultId(rows, "finance_create_risk_policy"));
								})
							}
						>
							Save risk policy
						</Primary>
					</div>
				) : null}
				{policyId && evaluationAccepted === null ? (
					<Primary
						disabled={busy}
						onClick={() =>
							run(async () => {
								const rows = await governed("evaluate_risk_policy", { policy_id: policyId, book_id: bookId });
								const id = resultId(rows, "finance_evaluate_risk_policy");
								const evaluations = await governed("read_evaluations", {});
								const found = evaluations.find((row) => row.id === id);
								const accepted = found?.accepted === true;
								setEvaluationAccepted(accepted);
								setEvaluation(
									accepted
										? `Evaluation accepted. Digest ${String(found?.evaluation_digest ?? "")}.`
										: "Evaluation did not accept this result. Approval stays unavailable.",
								);
							})
						}
					>
						Evaluate risk
					</Primary>
				) : null}
				{evaluation ? <Note>{evaluation}</Note> : null}
				{evaluationAccepted && !approvalId ? (
					<div className="space-y-3 border-t border-ink/10 pt-4">
						<h3 className="text-sm text-ink">Human approval</h3>
						<Note>This approves the paper result you just reviewed. The recorded digests are checked again by the database.</Note>
						<HumanAct
							disabled={busy}
							onClick={() =>
								run(async () => {
									const rows = await governed("approve_strategy", { book_id: bookId });
									const id = resultId(rows, "finance_approve_strategy_result");
									setApprovalId(id);
									const approvals = await governed("read_approvals", {});
									const found = approvals.find((row) => row.id === id);
									setApprovalDigest(typeof found?.strategy_digest === "string" ? found.strategy_digest : "");
								})
							}
						>
							Approve this result
						</HumanAct>
					</div>
				) : null}
				{approvalId ? <Note>Approval recorded{approvalDigest ? `. Strategy digest ${approvalDigest}` : ""}.</Note> : null}
			</Card>

			<Card title="Review Execution Safety">
				<Note>This review records decisions. It does not send an order, and it cannot permit live execution.</Note>
				{!approvalId ? <Note>Human approval is required before an order intent.</Note> : null}
				{approvalId && !intentId ? (
					<Primary disabled={busy} onClick={() => run(async () => setIntentId(resultId(await governed("create_order_intent", { approval_id: approvalId }), "finance_create_order_intent")))}>
						Record order intent
					</Primary>
				) : null}
				{intentId && !rechecked ? (
					<div className="space-y-2">
						<Note>Order intent recorded.</Note>
						<Primary disabled={busy} onClick={() => run(async () => { await governed("recheck_order_intent", { intent_id: intentId }); setRechecked(true); })}>
							Re-check risk
						</Primary>
					</div>
				) : null}
				{rechecked && !authorizationId ? (
					<div className="space-y-3">
						<Note>Risk re-check completed.</Note>
						<HumanAct disabled={busy} onClick={() => run(async () => setAuthorizationId(resultId(await governed("authorize_order_intent", { intent_id: intentId }), "finance_authorize_order_intent")))}>
							Authorize this intent
						</HumanAct>
					</div>
				) : null}
				{authorizationId && !contractId ? (
					<div className="space-y-2">
						<Note>Human authorization recorded.</Note>
						<Primary disabled={busy} onClick={() => run(async () => setContractId(resultId(await governed("create_execution_contract", { authorization_id: authorizationId }), "finance_create_execution_contract")))}>
							Record the contract
						</Primary>
					</div>
				) : null}
				{contractId && !productionAuthorizationId ? (
					<div className="space-y-2">
						<Note>Contract recorded.</Note>
						<Primary disabled={busy} onClick={() => run(async () => setProductionAuthorizationId(resultId(await governed("record_production_authorization", { contract_id: contractId }), "finance_record_production_authorization")))}>
							Record production authorization
						</Primary>
					</div>
				) : null}
				{productionAuthorizationId && !cancelled && !safetyPassed ? (
					<div className="space-y-3">
						<Note>Production authorization recorded. Cancelling it is one-way.</Note>
						<Primary disabled={busy} onClick={() => run(async () => { await governed("pass_production_safety", { contract_id: contractId }); setSafetyPassed(true); })}>
							Pass safety review
						</Primary>
						<button type="button" disabled={busy} onClick={() => run(async () => { await governed("cancel_production_authorization", { contract_id: contractId }); setCancelled(true); })} className="block text-[12px] text-ink/60 underline">
							Cancel this authorization
						</button>
					</div>
				) : null}
				{cancelled ? <Note>Authorization cancelled. It cannot be restored here.</Note> : null}
				{safetyPassed && ceiling === "pending" ? (
					<div className="space-y-3">
						<Note>Safety review passed. The recorded default ceiling is 1 order and 10000 exposure, unless you save another ceiling.</Note>
						<div className="grid gap-3 sm:grid-cols-2">
							<Field label="Order ceiling">
								<input className={inputClass} value={orderLimit} onChange={(event) => setOrderLimit(event.target.value)} />
							</Field>
							<Field label="Exposure ceiling">
								<input className={inputClass} value={exposureLimit} onChange={(event) => setExposureLimit(event.target.value)} />
							</Field>
						</div>
						<div className="flex flex-wrap gap-3">
							<Primary
								disabled={busy}
								onClick={() =>
									run(async () => {
										await governed("set_production_limit", {
											organization_id: organizationId,
											limit: { order_limit: Number(orderLimit), exposure_limit: Number(exposureLimit) },
										});
										setCeiling("saved");
									})
								}
							>
								Save ceiling
							</Primary>
							<button type="button" disabled={busy} onClick={() => setCeiling("default")} className="text-[12px] text-ink/60 underline">
								Keep the recorded default
							</button>
						</div>
					</div>
				) : null}
				{safetyPassed && ceiling !== "pending" && !dispatchId ? (
					<div className="space-y-3 border-t border-ink/10 pt-4">
						<Note>Recording the dispatch review does not send an order. Live execution stays blocked.</Note>
						<button
							type="button"
							disabled={busy}
							onClick={() => run(async () => setDispatchId(resultId(await governed("record_production_dispatch", { contract_id: contractId }), "finance_record_production_dispatch")))}
							className="rounded-full border border-ink/20 px-4 py-2 text-[13px] text-ink/80"
						>
							Record dispatch review
						</button>
					</div>
				) : null}
				{dispatchId && !observed ? (
					<div className="space-y-3">
						<Note>Dispatch review recorded. The observation below is a label, not a broker fill.</Note>
						<Field label="Observation label">
							<select className={inputClass} value={observation} onChange={(event) => setObservation(event.target.value as typeof observation)}>
								{OBSERVATION_LABELS.map(([value, label]) => (
									<option key={value} value={value}>
										{label}
									</option>
								))}
							</select>
						</Field>
						<Primary disabled={busy} onClick={() => run(async () => { await governed("record_observed_production_result", { contract_id: contractId, observation }); setObserved(true); })}>
							Record observation
						</Primary>
					</div>
				) : null}
				{observed && !reconciled ? (
					<Primary disabled={busy} onClick={() => run(async () => { await governed("reconcile_observed_production_result", { contract_id: contractId }); setReconciled(true); })}>
						Reconcile observation
					</Primary>
				) : null}
				{reconciled ? <Note>Observation reconciled. LIVE EXECUTION: BLOCKED</Note> : null}
				{contractId ? (
					<div className="space-y-2 border-t border-amber-900/30 pt-4">
						<h3 className="text-sm text-ink">Emergency stop</h3>
						<Note>Engaging the kill switch is separate from the review. It cannot be undone here.</Note>
						{killEngaged ? (
							<Note>Kill switch engaged.</Note>
						) : (
							<button
								type="button"
								disabled={busy}
								onClick={() => run(async () => { await governed("engage_kill_switch", { contract_id: contractId }); setKillEngaged(true); })}
								className="rounded-full border border-amber-900/40 px-4 py-2 text-[13px] text-amber-950"
							>
								Engage kill switch
							</button>
						)}
					</div>
				) : null}
			</Card>
		</main>
	);
}

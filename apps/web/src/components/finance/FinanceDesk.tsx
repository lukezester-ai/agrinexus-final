"use client";

import { useState } from "react";
import { FINANCE_CATALOG } from "@/lib/finance-catalog";

const SURFACES = [
	["intelligence", "Finance Intelligence"],
	["copilot", "AI Strategy Copilot"],
	["governance", "Risk & Governance"],
	["safety", "Review Execution Safety"],
] as const;

export function FinanceDesk() {
	const [operation, setOperation] = useState<(typeof FINANCE_CATALOG)[number]["name"]>(FINANCE_CATALOG[0].name);
	const [input, setInput] = useState("{}");
	const [output, setOutput] = useState("");

	const selected = FINANCE_CATALOG.find((item) => item.name === operation) ?? FINANCE_CATALOG[0];

	async function submit(event: React.FormEvent) {
		event.preventDefault();
		let parsed: unknown = {};
		if (selected.fields.length > 0) {
			try {
				parsed = JSON.parse(input);
			} catch {
				setOutput("field is not allowed");
				return;
			}
		}
		const response = await fetch("/api/finance", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ operation: selected.name, input: parsed }),
		});
		setOutput(await response.text());
	}

	return (
		<main className="mx-auto max-w-3xl px-6 py-10">
			<p className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink/50">Finance Intelligence</p>
			<h1 className="mb-4 font-serif text-3xl text-ink">Decision infrastructure</h1>
			<p className="mb-8 rounded-2xl border border-ink/10 bg-white/80 px-4 py-3 text-sm text-ink">
				LIVE EXECUTION: BLOCKED
			</p>
			{SURFACES.map(([surface, title]) => (
				<section key={surface} className="mb-8">
					<h2 className="mb-3 text-sm font-medium text-ink">{title}</h2>
					<ul className="flex flex-wrap gap-2">
						{FINANCE_CATALOG.filter((item) => item.surface === surface).map((item) => (
							<li key={item.name}>
								<button
									type="button"
									onClick={() => setOperation(item.name)}
									className={`rounded-full border px-3 py-1 text-[12px] ${item.name === operation ? "border-ink bg-ink text-white" : "border-ink/10 bg-white text-ink"}`}
								>
									{item.name}
								</button>
							</li>
						))}
					</ul>
				</section>
			))}
			<form onSubmit={submit} className="space-y-3 rounded-2xl border border-ink/10 bg-white/80 p-4">
				<p className="text-[12px] text-ink/60">
					{selected.group} · {selected.fields.join(", ") || "no input"}
				</p>
				{selected.fields.length > 0 ? (
					<textarea
						value={input}
						onChange={(event) => setInput(event.target.value)}
						rows={8}
						className="w-full rounded-xl border border-ink/10 p-3 font-mono text-[12px]"
					/>
				) : null}
				<button type="submit" className="rounded-full bg-ink px-4 py-2 text-[13px] text-white">
					Run governed call
				</button>
			</form>
			{output ? <pre className="mt-4 overflow-auto rounded-2xl bg-ink px-4 py-3 text-[12px] text-white">{output}</pre> : null}
		</main>
	);
}

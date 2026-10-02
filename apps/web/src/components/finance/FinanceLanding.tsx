import { Link } from "@/i18n/navigation";

export function FinanceLanding() {
	return (
		<main className="mx-auto max-w-3xl px-6 py-16">
			<p className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink/50">Finance Intelligence</p>
			<h1 className="mb-4 font-serif text-3xl text-ink">Decision infrastructure</h1>
			<p className="mb-6 rounded-2xl border border-ink/10 bg-white/80 px-4 py-3 text-sm text-ink">LIVE EXECUTION: BLOCKED</p>
			<p className="mb-8 max-w-xl text-sm leading-6 text-ink/80">
				Sign in to walk a market, a strategy candidate, a human risk approval, and an execution-safety review. Nothing is sent to a broker.
			</p>
			<Link href="/login" className="rounded-full bg-ink px-4 py-2 text-[13px] text-white">
				Sign in
			</Link>
		</main>
	);
}

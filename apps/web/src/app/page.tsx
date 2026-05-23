import { ApiStatus } from "@/components/api-status";

export const dynamic = "force-dynamic";

export default function Home() {
	return (
		<main className="mx-auto max-w-2xl px-6 py-16">
			<p className="text-sm font-medium uppercase tracking-wide text-emerald-800">AgriNexus · apps/web</p>
			<h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Next.js scaffold</h1>
			<p className="mt-3 text-slate-600">
				This app talks to the FastAPI backend (see <code className="rounded bg-slate-200 px-1">apps/backend</code>). Run{" "}
				<code className="rounded bg-slate-200 px-1">docker compose up</code> or both dev servers from the repo root.
			</p>
			<div className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
				<h2 className="text-sm font-semibold text-slate-800">Backend health</h2>
				<ApiStatus />
			</div>
		</main>
	);
}

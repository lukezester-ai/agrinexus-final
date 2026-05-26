import { Link } from "@/i18n/navigation";

export const metadata = {
	title: "Login · AgriNexus",
	description: "Auth skeleton — no real session yet",
};

export default function LoginPage() {
	return (
		<main className="mx-auto max-w-md px-6 py-16">
			<p className="text-sm font-medium uppercase tracking-wide text-emerald-800">AgriNexus · apps/web</p>
			<h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Login (skeleton)</h1>
			<p className="mt-2 text-sm text-slate-600">
				Placeholder for OAuth / email magic link. Wire to <code className="rounded bg-slate-200 px-1">apps/backend</code> when auth
				exists.
			</p>
			<div className="mt-8 space-y-4" role="group" aria-label="Login fields (skeleton)">
				<label className="block text-sm font-medium text-slate-700">
					Email
					<input
						type="email"
						name="email"
						autoComplete="email"
						className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm outline-none focus:border-emerald-600"
						placeholder="you@farm.example"
					/>
				</label>
				<button
					type="button"
					className="w-full rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white opacity-60"
					disabled
				>
					Continue (not wired)
				</button>
			</div>
			<p className="mt-8 text-sm">
				<Link href="/" className="text-emerald-800 underline underline-offset-4">
					← Home
				</Link>
			</p>
		</main>
	);
}

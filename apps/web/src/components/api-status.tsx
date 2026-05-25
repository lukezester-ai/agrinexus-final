const defaultApi = "http://127.0.0.1:8000";

function apiBase(): string {
	const fromEnv = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
	return (fromEnv ?? defaultApi).replace(/\/$/, "");
}

async function fetchHealth(): Promise<{ ok: boolean; body: string }> {
	const base = apiBase();
	try {
		const res = await fetch(`${base}/health`, {
			cache: "no-store",
		});
		const text = await res.text();
		return { ok: res.ok, body: text };
	} catch (e) {
		return { ok: false, body: e instanceof Error ? e.message : "Request failed" };
	}
}

export async function ApiStatus() {
	const { ok, body } = await fetchHealth();
	const base = apiBase();
	return (
		<div className="mt-3">
			<p className={`text-sm font-mono ${ok ? "text-emerald-700" : "text-amber-800"}`}>
				{ok ? "● OK" : "● Недостъпен"} — <span className="text-slate-600">{body.slice(0, 200)}</span>
			</p>
			<p className="mt-2 text-xs text-slate-500">
				API: <code className="rounded bg-slate-100 px-1">{base}</code> — задай{" "}
				<code className="rounded bg-slate-100 px-1">API_URL</code> или{" "}
				<code className="rounded bg-slate-100 px-1">NEXT_PUBLIC_API_URL</code> в <code className="rounded bg-slate-100 px-1">.env.local</code>
				.
			</p>
			<p className="mt-2 text-xs text-slate-500">
				Документация (Swagger):{" "}
				<a className="font-medium text-emerald-800 underline underline-offset-2" href={`${base}/docs`} target="_blank" rel="noreferrer">
					{base}/docs
				</a>
				{" · "}
				В dev Next пренасочва <code className="rounded bg-slate-100 px-1">/api/py/*</code> към същия backend (
				<a className="font-medium text-emerald-800 underline underline-offset-2" href="/api/py/health" target="_blank" rel="noreferrer">
					/api/py/health
				</a>
				).
			</p>
		</div>
	);
}

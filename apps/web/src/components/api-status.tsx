const defaultApi = "http://127.0.0.1:8000";

async function fetchHealth(): Promise<{ ok: boolean; body: string }> {
	const base = process.env.NEXT_PUBLIC_API_URL ?? defaultApi;
	try {
		const res = await fetch(`${base.replace(/\/$/, "")}/health`, {
			next: { revalidate: 0 },
		});
		const text = await res.text();
		return { ok: res.ok, body: text };
	} catch (e) {
		return { ok: false, body: e instanceof Error ? e.message : "Request failed" };
	}
}

export async function ApiStatus() {
	const { ok, body } = await fetchHealth();
	return (
		<div className="mt-3">
			<p className={`text-sm font-mono ${ok ? "text-emerald-700" : "text-amber-800"}`}>
				{ok ? "● OK" : "● Unreachable"} — <span className="text-slate-600">{body.slice(0, 200)}</span>
			</p>
			<p className="mt-2 text-xs text-slate-500">
				API base: <code>{process.env.NEXT_PUBLIC_API_URL ?? defaultApi}</code> (set <code>NEXT_PUBLIC_API_URL</code> in{" "}
				<code>.env.local</code>)
			</p>
		</div>
	);
}

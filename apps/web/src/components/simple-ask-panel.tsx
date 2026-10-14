"use client";

import { useState } from "react";

function friendlyRoute(lastRoute: string | null | undefined, handledBy: string | undefined): string {
	const r = `${lastRoute || ""} ${handledBy || ""}`.toLowerCase();
	if (r.includes("market")) return "пазар и цени";
	if (r.includes("analytics")) return "анализ на данни";
	if (r.includes("weather")) return "време и агрономия";
	if (r.includes("academy")) return "обучение и курсове";
	if (r.includes("general")) return "общ отговор";
	return (lastRoute || handledBy || "асистент").trim() || "асистент";
}

export function SimpleAskPanel() {
	const [q, setQ] = useState("");
	const [loading, setLoading] = useState(false);
	const [reply, setReply] = useState<string | null>(null);
	const [meta, setMeta] = useState<string | null>(null);
	const [err, setErr] = useState<string | null>(null);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setErr(null);
		setReply(null);
		setMeta(null);
		const message = q.trim();
		if (!message) return;
		setLoading(true);
		try {
			const res = await fetch("/api/ask-agrinexus", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ message, sessionId: "web-demo" }),
			});
			const data = (await res.json()) as {
				response?: unknown;
				handledBy?: string;
				lastRoute?: string | null;
				error?: string;
			};
			if (!res.ok) {
				setErr(data.error || `Грешка ${res.status}`);
				return;
			}
			const text = typeof data.response === "string" ? data.response : JSON.stringify(data.response ?? "");
			setReply(text);
			setMeta(`Модул: ${friendlyRoute(data.lastRoute, data.handledBy)}`);
		} catch {
			setErr("Мрежова грешка. Провери дали Next работи.");
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6 shadow-sm">
			<h2 className="text-sm font-semibold text-emerald-900">Питай на обикновен език</h2>
			<p className="mt-2 text-sm text-slate-700">
				Няма нужда да знаеш какво е RAG или LangChain. Напиши въпрос на български или английски — системата сама избира
				подходящ „екип“ (пазар, време, обучение и т.н.).
			</p>
			<form onSubmit={onSubmit} className="mt-4 space-y-3">
				<textarea
					value={q}
					onChange={(e) => setQ(e.target.value)}
					rows={3}
					placeholder='Напр.: „Какво означава delayed CBOT за пшеницата?“ или „Кога да поливам при температури 12–18°C?“'
					className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-inner outline-none focus:border-emerald-500"
				/>
				<button
					type="submit"
					disabled={loading}
					className="rounded-full bg-emerald-800 px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
				>
					{loading ? "Изчакай…" : "Изпрати"}
				</button>
			</form>
			{err && (
				<p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">{err}</p>
			)}
			{reply && (
				<div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-800 whitespace-pre-wrap">
					{reply}
				</div>
			)}
			{meta && <p className="mt-2 text-xs text-slate-500">{meta}</p>}
		</div>
	);
}

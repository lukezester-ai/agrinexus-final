"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatFeedback } from "./ChatFeedback";

type ChatMessage = {
	id: string;
	role: "user" | "assistant";
	text: string;
	agent?: string;
	traceId?: string;
};

type Props = {
	locale: string;
	compact?: boolean;
	/** Full-height chat on mobile dashboard */
	mobileFill?: boolean;
};

const copy = {
	en: {
		title: "Ask AgriNexus",
		sub: "Market, weather, field, academy — Mistral routes your question to the right agent.",
		placeholder: "Ask anything… e.g. “What does today’s wheat move mean for my forward window?”",
		send: "Send",
		sending: "Thinking…",
		empty: "Start a conversation with the agent mesh.",
		agent: "Agent",
		offline: "Chat needs MISTRAL_API_KEY on the server (Vercel → apps/web).",
		err: "Could not reach chat. Try again.",
	},
	bg: {
		title: "Попитай AgriNexus",
		sub: "Пазар, метео, поле, академия — Mistral насочва въпроса към правилния агент.",
		placeholder: "Попитай каквото и да е… напр. „Какво означава движението на пшеницата днес?“",
		send: "Изпрати",
		sending: "Мисля…",
		empty: "Започни разговор с AI мрежата.",
		agent: "Агент",
		offline: "Чатът изисква MISTRAL_API_KEY на сървъра (Vercel → apps/web).",
		err: "Няма връзка с чата. Опитай отново.",
	},
};

function newId(): string {
	return `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function AgriNexusChat({ locale, compact, mobileFill }: Props) {
	const c = locale === "bg" ? copy.bg : copy.en;
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [input, setInput] = useState("");
	const [loading, setLoading] = useState(false);
	const [configured, setConfigured] = useState<boolean | null>(null);
	const bottomRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		fetch("/api/chat")
			.then((r) => r.json())
			.then((d: { configured?: boolean }) => setConfigured(Boolean(d.configured)))
			.catch(() => setConfigured(false));
	}, []);

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages, loading]);

	const send = useCallback(async () => {
		const text = input.trim();
		if (!text || loading) return;

		const userMsg: ChatMessage = { id: newId(), role: "user", text };
		setMessages((prev) => [...prev, userMsg]);
		setInput("");
		setLoading(true);

		try {
			const res = await fetch("/api/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ message: text, locale }),
			});
			const data = (await res.json()) as {
				response?: string;
				handledBy?: string;
				error?: string;
				traceId?: string;
			};
			const reply =
				typeof data.response === "string" && data.response
					? data.response
					: data.error || c.err;
			setMessages((prev) => [
				...prev,
				{
					id: newId(),
					role: "assistant",
					text: reply,
					agent: data.handledBy,
					traceId: data.traceId,
				},
			]);
		} catch {
			setMessages((prev) => [
				...prev,
				{ id: newId(), role: "assistant", text: c.err },
			]);
		} finally {
			setLoading(false);
		}
	}, [input, loading, locale, c.err]);

	return (
		<div
			className={`flex flex-col rounded-2xl border border-white/70 bg-white/55 backdrop-blur-xl overflow-hidden ${
				compact
					? "h-[420px]"
					: mobileFill
						? "min-h-[calc(100dvh-11rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] md:min-h-[min(70vh,640px)]"
						: "min-h-[min(70vh,640px)]"
			}`}
		>
			{!compact ? (
				<div className="border-b border-ink/[0.06] px-5 py-4">
					<h1 className="font-serif text-xl text-ink">{c.title}</h1>
					<p className="mt-1 text-xs text-ink/55">{c.sub}</p>
					{configured === false ? (
						<p className="mt-2 text-[11px] text-amber-800/90">{c.offline}</p>
					) : null}
				</div>
			) : null}

			<div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-[200px]">
				{messages.length === 0 && !loading ? (
					<p className="text-sm text-ink/45 text-center py-8">{c.empty}</p>
				) : null}
				{messages.map((m) => (
					<div
						key={m.id}
						className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
					>
						<div
							className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
								m.role === "user"
									? "bg-forest-700 text-white"
									: "bg-ink/[0.05] text-ink border border-ink/[0.06]"
							}`}
						>
							{m.agent ? (
								<p className="text-[10px] font-mono uppercase tracking-wide text-ink/45 mb-1">
									{c.agent}: {m.agent}
								</p>
							) : null}
							<p className="m-0 whitespace-pre-wrap">{m.text}</p>
							{m.role === "assistant" && m.traceId && (
								<ChatFeedback traceId={m.traceId} />
							)}
						</div>
					</div>
				))}
				{loading ? (
					<div className="text-xs text-ink/45 animate-pulse px-2">{c.sending}</div>
				) : null}
				<div ref={bottomRef} />
			</div>

			<form
				className="border-t border-ink/[0.06] p-3 flex gap-2"
				onSubmit={(e) => {
					e.preventDefault();
					void send();
				}}
			>
				<input
					type="text"
					value={input}
					onChange={(e) => setInput(e.target.value)}
					placeholder={c.placeholder}
					disabled={loading}
					className="flex-1 rounded-xl border border-ink/10 bg-white/80 px-3 py-2.5 text-sm outline-none focus:border-forest-500"
				/>
				<button
					type="submit"
					disabled={loading || !input.trim()}
					className="shrink-0 rounded-xl bg-forest-700 px-4 py-2.5 text-[13px] font-medium text-white disabled:opacity-50"
				>
					{loading ? "…" : c.send}
				</button>
			</form>
		</div>
	);
}

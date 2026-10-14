"use client";

import { useCallback, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
	BRIEFING_STORAGE_KEY,
	isTelegramLinked,
	parseBriefingPreferences,
	type BriefingPreferences,
} from "@/lib/briefing-preferences";
import type { BriefingCard } from "@/lib/weekly-briefing";

type Props = {
	locale: string;
	userId: string;
	initial: BriefingPreferences | null;
};

const copy = {
	en: {
		title: "Monday briefing (Telegram)",
		sub: "A short decision card each Monday — wheat reference, your margin, and a link to the market desk.",
		enabled: "Send weekly briefing",
		connect: "Connect Telegram",
		connected: (u?: string) =>
			u ? `Connected as @${u}` : "Telegram connected",
		preview: "Preview this week's card",
		testSend: "Send test to Telegram",
		viber: "Viber — coming soon",
		save: "Save briefing preferences",
		saving: "Saving…",
		saved: "Saved.",
		err: "Could not save. Run apps/backend/rag/farm_profiles_briefing.sql in Supabase.",
		noBot: "Telegram bot not configured (NEXT_PUBLIC_TELEGRAM_BOT_USERNAME).",
		previewLoading: "Loading preview…",
		testOk: "Test message sent.",
		testErr: "Could not send — connect Telegram first and set TELEGRAM_BOT_TOKEN on the server.",
		sqlHint: "Migration: apps/backend/rag/farm_profiles_briefing.sql",
	},
	bg: {
		title: "Понеделничен briefing (Telegram)",
		sub: "Кратка decision card всеки понеделник — референция пшеница, твоята маржа и линк към пазарното табло.",
		enabled: "Изпращай седмичен briefing",
		connect: "Свържи Telegram",
		connected: (u?: string) =>
			u ? `Свързан като @${u}` : "Telegram е свързан",
		preview: "Преглед за тази седмица",
		testSend: "Тестово изпращане в Telegram",
		viber: "Viber — скоро",
		save: "Запази настройките за briefing",
		saving: "Запазване…",
		saved: "Запазено.",
		err: "Неуспешно. Пусни apps/backend/rag/farm_profiles_briefing.sql в Supabase.",
		noBot: "Telegram ботът не е конфигуриран (NEXT_PUBLIC_TELEGRAM_BOT_USERNAME).",
		previewLoading: "Зареждане…",
		testOk: "Тестовото съобщение е изпратено.",
		testErr: "Неуспешно — първо свържи Telegram и задай TELEGRAM_BOT_TOKEN на сървъра.",
		sqlHint: "Миграция: apps/backend/rag/farm_profiles_briefing.sql",
	},
};

function loadInitial(initial: BriefingPreferences | null): BriefingPreferences {
	if (initial && (initial.enabled || isTelegramLinked(initial))) return initial;
	if (typeof window === "undefined") return { enabled: false };
	try {
		const raw = localStorage.getItem(BRIEFING_STORAGE_KEY);
		if (raw) return parseBriefingPreferences(JSON.parse(raw));
	} catch {
		/* ignore */
	}
	return { enabled: false };
}

export function BriefingConnect({ locale, userId, initial }: Props) {
	const c = locale === "bg" ? copy.bg : copy.en;
	const [prefs, setPrefs] = useState<BriefingPreferences>(() => loadInitial(initial));
	const [loading, setLoading] = useState(false);
	const [msg, setMsg] = useState<"ok" | "err" | null>(null);
	const [preview, setPreview] = useState<BriefingCard | null>(null);
	const [previewLoading, setPreviewLoading] = useState(false);
	const [testMsg, setTestMsg] = useState<"ok" | "err" | null>(null);

	const botUsername =
		process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim() || "";
	const deepLink = useMemo(() => {
		if (!botUsername) return null;
		return `https://t.me/${botUsername}?start=link_${userId}`;
	}, [botUsername, userId]);

	const linked = isTelegramLinked(prefs);

	const persist = useCallback(
		async (next: BriefingPreferences) => {
			setLoading(true);
			setMsg(null);
			const { error } = await supabase
				.from("farm_profiles")
				.update({ briefing_preferences: next })
				.eq("user_id", userId);

			try {
				localStorage.setItem(BRIEFING_STORAGE_KEY, JSON.stringify(next));
			} catch {
				/* ignore */
			}

			if (error) setMsg("err");
			else setMsg("ok");
			setLoading(false);
		},
		[userId],
	);

	const handleToggle = async (enabled: boolean) => {
		const next = { ...prefs, enabled };
		setPrefs(next);
		await persist(next);
	};

	const handleSave = async (e: React.FormEvent) => {
		e.preventDefault();
		await persist(prefs);
	};

	const loadPreview = async () => {
		setPreviewLoading(true);
		setPreview(null);
		try {
			const res = await fetch("/api/briefing/preview");
			if (res.ok) {
				const data = (await res.json()) as { card: BriefingCard };
				setPreview(data.card);
			}
		} finally {
			setPreviewLoading(false);
		}
	};

	const sendTest = async () => {
		setTestMsg(null);
		const res = await fetch("/api/briefing/send-test", { method: "POST" });
		setTestMsg(res.ok ? "ok" : "err");
	};

	return (
		<section className="mt-8 border-t border-ink/10 pt-8">
			<h2 className="font-serif text-lg font-medium tracking-tight text-ink">{c.title}</h2>
			<p className="mt-1 text-xs leading-relaxed text-ink/55">{c.sub}</p>

			<form onSubmit={handleSave} className="mt-5 flex flex-col gap-4">
				<label className="flex items-center gap-3 text-sm text-ink/80">
					<input
						type="checkbox"
						checked={prefs.enabled}
						onChange={(e) => handleToggle(e.target.checked)}
						className="h-4 w-4 rounded border-ink/20"
					/>
					{c.enabled}
				</label>

				{linked ? (
					<p className="text-xs text-forest-700">
						{c.connected(prefs.telegram_username)}
					</p>
				) : deepLink ? (
					<a
						href={deepLink}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex w-fit items-center justify-center rounded-xl bg-[#229ED9] px-4 py-2.5 text-[13px] font-medium text-white hover:opacity-90"
					>
						{c.connect}
					</a>
				) : (
					<p className="text-xs text-ink/50">{c.noBot}</p>
				)}

				<p className="text-[10px] text-ink/45">{c.sqlHint}</p>

				<div className="flex flex-wrap gap-2">
					<button
						type="button"
						onClick={loadPreview}
						disabled={previewLoading}
						className="rounded-xl border border-ink/15 bg-white/60 px-4 py-2 text-[12px] font-medium text-ink hover:bg-white"
					>
						{previewLoading ? c.previewLoading : c.preview}
					</button>
					<button
						type="button"
						onClick={sendTest}
						disabled={!linked}
						className="rounded-xl border border-forest-700/25 bg-forest-700/10 px-4 py-2 text-[12px] font-medium text-forest-800 hover:bg-forest-700/15 disabled:opacity-40"
					>
						{c.testSend}
					</button>
				</div>

				{testMsg === "ok" ? (
					<p className="text-xs text-forest-700">{c.testOk}</p>
				) : null}
				{testMsg === "err" ? (
					<p className="text-xs text-semantic-alert">{c.testErr}</p>
				) : null}

				{preview ? (
					<div className="rounded-xl border border-ink/10 bg-ink/[0.03] px-4 py-3 text-xs font-mono leading-relaxed text-ink/85 whitespace-pre-wrap">
						<p className="font-sans font-medium text-ink mb-2">{preview.title}</p>
						{preview.lines.map((line) => (
							<p key={line}>{line}</p>
						))}
						<p className="mt-2 text-ink/70">{preview.suggestion}</p>
						<p className="mt-2 text-[10px] text-ink/45">{preview.disclaimer}</p>
					</div>
				) : null}

				<p className="text-xs text-ink/40 italic">{c.viber}</p>

				<button
					type="submit"
					disabled={loading}
					className="rounded-xl bg-forest-700 px-4 py-2.5 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-50"
				>
					{loading ? c.saving : c.save}
				</button>
				{msg === "ok" ? <p className="text-xs text-forest-700">{c.saved}</p> : null}
				{msg === "err" ? <p className="text-xs text-semantic-alert">{c.err}</p> : null}
			</form>
		</section>
	);
}

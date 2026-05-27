"use client";

import { useLocale } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { AppLocale } from "@/i18n/routing";
import { allLecturesForLocale, coursesForLocale, lectureMetaById, type LectureMeta } from "@/content/academy-courses";

const MAX_CONTEXT = 9000;
/** Sync with `apps/web/src/app/api/elevenlabs-tts/route.ts` MAX_CHARS */
const ELEVENLABS_MAX_CHARS = 4500;

function composeTutorMessage(meta: LectureMeta, body: string, studentQuestion: string): string {
	const head = `Ти си лектор в AgriNexus Academy. Отговори на български, ясно и уважително. Ползвай САМО текста на лекцията като фактологична основа; ако нещо липсва, кажи че не е в лекцията.

Курс: „${meta.courseTitle}“
ЛЕКЦИЯ: „${meta.title}“
Резюме: ${meta.summary}

--- ТЕКСТ НА ЛЕКЦИЯТА ---
`;
	const tail = `

--- ВЪПРОС / МОЛБА НА УЧЕНИКА ---
${studentQuestion.trim()}`;
	let b = body;
	if (head.length + b.length + tail.length > MAX_CONTEXT) {
		const allow = Math.max(500, MAX_CONTEXT - head.length - tail.length - 80);
		b = b.slice(0, allow) + "\n\n[…съкратено автоматично за лимит на съобщението — добавете по-къса лекция или разделете на части.]";
	}
	return head + b + tail;
}

export function AcademyLecturer() {
	const locale = useLocale() as AppLocale;
	const searchParams = useSearchParams();
	const courses = useMemo(() => coursesForLocale(locale), [locale]);
	const lectures = useMemo(() => allLecturesForLocale(locale), [locale]);
	const [id, setId] = useState(() => lectures[0]!.id);
	const [body, setBody] = useState("");
	const [loadState, setLoadState] = useState<"idle" | "loading" | "ok" | "error">("idle");
	const [loadError, setLoadError] = useState<string | null>(null);
	const [voicesReady, setVoicesReady] = useState(false);
	const [speaking, setSpeaking] = useState(false);
	const [elevenConfigured, setElevenConfigured] = useState(false);
	const [elevenLoading, setElevenLoading] = useState(false);
	const [elevenPlayback, setElevenPlayback] = useState(false);
	const [elevenErr, setElevenErr] = useState<string | null>(null);
	const [elevenTruncated, setElevenTruncated] = useState(false);
	const elevenAudioRef = useRef<HTMLAudioElement | null>(null);
	const elevenUrlRef = useRef<string | null>(null);
	const [question, setQuestion] = useState("Обясни ми с прости думи най-важното за бизнеса от тази лекция.");
	const [reply, setReply] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [err, setErr] = useState<string | null>(null);

	useEffect(() => {
		const first = lectures[0]?.id;
		if (!first) return;
		setId((prev) => (lectures.some((l) => l.id === prev) ? prev : first));
	}, [lectures]);

	const meta = useMemo(() => lectures.find((l) => l.id === id) ?? lectures[0]!, [id, lectures]);

	const speechText = useMemo(() => {
		if (!body) return "";
		return `${meta.courseTitle}. ${meta.title}. ${meta.summary}. ${body}`;
	}, [body, meta.courseTitle, meta.summary, meta.title]);

	useEffect(() => {
		const focus = searchParams.get("focus");
		if (!focus) return;
		const found = lectureMetaById(focus, locale);
		if (found) setId(found.id);
	}, [searchParams, locale]);

	useEffect(() => {
		let cancelled = false;
		setLoadState("loading");
		setLoadError(null);
		setBody("");
		setReply(null);
		setErr(null);

		const url = `/lectures/${encodeURIComponent(meta.file)}`;
		fetch(url, { cache: "no-store" })
			.then(async (res) => {
				if (!res.ok) throw new Error(res.status === 404 ? `Няма файл: ${meta.file}` : `HTTP ${res.status}`);
				return res.text();
			})
			.then((text) => {
				if (cancelled) return;
				setBody(text.trim());
				setLoadState("ok");
			})
			.catch((e: unknown) => {
				if (cancelled) return;
				setLoadState("error");
				setLoadError(e instanceof Error ? e.message : "Грешка при зареждане");
			});

		return () => {
			cancelled = true;
		};
	}, [meta.file, meta.id]);

	useEffect(() => {
		const load = () => setVoicesReady(true);
		load();
		window.speechSynthesis.onvoiceschanged = load;
		return () => {
			window.speechSynthesis.onvoiceschanged = () => {};
		};
	}, []);

	useEffect(() => {
		let cancelled = false;
		fetch("/api/elevenlabs-tts", { method: "GET" })
			.then((r) => r.json() as Promise<{ configured?: boolean }>)
			.then((j) => {
				if (!cancelled) setElevenConfigured(Boolean(j.configured));
			})
			.catch(() => {
				if (!cancelled) setElevenConfigured(false);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const stopSpeech = useCallback(() => {
		window.speechSynthesis.cancel();
		if (elevenAudioRef.current) {
			elevenAudioRef.current.pause();
			elevenAudioRef.current.currentTime = 0;
			elevenAudioRef.current = null;
		}
		if (elevenUrlRef.current) {
			URL.revokeObjectURL(elevenUrlRef.current);
			elevenUrlRef.current = null;
		}
		setSpeaking(false);
		setElevenLoading(false);
		setElevenPlayback(false);
	}, []);

	const readAloud = useCallback(() => {
		if (!speechText) return;
		stopSpeech();
		const text = speechText;
		const u = new SpeechSynthesisUtterance(text);
		u.lang = locale === "en" ? "en-US" : "bg-BG";
		const voices = window.speechSynthesis.getVoices();
		const v =
			voices.find((x) => x.lang.toLowerCase().startsWith("bg")) ||
			voices.find((x) => x.lang.toLowerCase().startsWith("ru")) ||
			null;
		if (v) u.voice = v;
		u.onend = () => setSpeaking(false);
		u.onerror = () => setSpeaking(false);
		setSpeaking(true);
		window.speechSynthesis.speak(u);
	}, [speechText, locale, stopSpeech]);

	const readElevenLabs = useCallback(async () => {
		if (!speechText) return;
		setElevenErr(null);
		setElevenTruncated(false);
		stopSpeech();
		let text = speechText;
		if (text.length > ELEVENLABS_MAX_CHARS) {
			text = text.slice(0, ELEVENLABS_MAX_CHARS);
			setElevenTruncated(true);
		}
		setElevenLoading(true);
		try {
			const res = await fetch("/api/elevenlabs-tts", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ text }),
			});
			if (!res.ok) {
				const data = (await res.json().catch(() => ({}))) as { error?: string };
				setElevenErr(data.error || `HTTP ${res.status}`);
				return;
			}
			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			elevenUrlRef.current = url;
			const audio = new Audio(url);
			elevenAudioRef.current = audio;
			audio.onended = () => {
				setSpeaking(false);
				setElevenPlayback(false);
				if (elevenUrlRef.current) {
					URL.revokeObjectURL(elevenUrlRef.current);
					elevenUrlRef.current = null;
				}
				elevenAudioRef.current = null;
			};
			audio.onerror = () => {
				setElevenErr("Възпроизвеждането на аудио се провали.");
				setSpeaking(false);
				setElevenPlayback(false);
				if (elevenUrlRef.current) {
					URL.revokeObjectURL(elevenUrlRef.current);
					elevenUrlRef.current = null;
				}
				elevenAudioRef.current = null;
			};
			await audio.play();
			setSpeaking(true);
			setElevenPlayback(true);
		} catch {
			setElevenErr("Мрежова грешка или блокирано автоматично възпроизвеждане.");
			if (elevenUrlRef.current) {
				URL.revokeObjectURL(elevenUrlRef.current);
				elevenUrlRef.current = null;
			}
		} finally {
			setElevenLoading(false);
		}
	}, [speechText, stopSpeech]);

	useEffect(() => {
		stopSpeech();
		setElevenErr(null);
		setElevenTruncated(false);
	}, [meta.id, stopSpeech]);

	async function askTutor() {
		if (!body) return;
		setErr(null);
		setReply(null);
		setLoading(true);
		try {
			const message = composeTutorMessage(meta, body, question);
			const res = await fetch("/api/academy-tutor-proxy", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ message }),
			});
			const data = (await res.json()) as { ok?: boolean; reply?: string; error?: string };
			if (!res.ok) {
				setErr(data.error || `Грешка ${res.status}`);
				return;
			}
			if (data.reply) setReply(data.reply);
			else setErr("Празен отговор от сървъра.");
		} catch {
			setErr("Мрежова грешка.");
		} finally {
			setLoading(false);
		}
	}

	const ready = loadState === "ok" && body.length > 0;

	return (
		<div className="space-y-8">
			<div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
				<label className="block text-sm font-medium text-slate-700">Избор на лекция (по курсове)</label>
				<select
					className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
					value={id}
					onChange={(e) => {
						setId(e.target.value);
						stopSpeech();
					}}
				>
					{courses.map((c) => (
						<optgroup key={c.slug} label={c.title}>
							{c.lectures.map((l) => (
								<option key={l.id} value={l.id}>
									{l.title}
								</option>
							))}
						</optgroup>
					))}
				</select>
				<p className="mt-2 text-sm text-slate-600">
					<span className="font-medium text-emerald-900">{meta.courseTitle}</span> — {meta.summary}
				</p>
				<p className="mt-2 text-xs text-slate-500">
					Файл: <code className="rounded bg-slate-100 px-1">public/lectures/{meta.file}</code>
				</p>
			</div>

			<article className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-6 shadow-sm">
				<h2 className="text-lg font-semibold text-emerald-950">{meta.title}</h2>
				{loadState === "loading" && <p className="mt-4 text-sm text-slate-600">Зареждане на лекцията…</p>}
				{loadState === "error" && (
					<p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{loadError}</p>
				)}
				{ready && <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">{body}</div>}
				<div className="mt-6 flex flex-wrap gap-3">
					<button
						type="button"
						onClick={readAloud}
						disabled={speaking || elevenLoading || !ready}
						className="rounded-full bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
					>
						{speaking && !elevenPlayback && !elevenLoading ? "Чете…" : "Чети на глас (браузър)"}
					</button>
					<button
						type="button"
						onClick={() => void readElevenLabs()}
						disabled={!elevenConfigured || speaking || elevenLoading || !ready}
						title={
							elevenConfigured
								? undefined
								: "Добави ELEVENLABS_API_KEY и ELEVENLABS_VOICE_ID в apps/web/.env.local (виж .env.example), после рестарт на dev сървъра."
						}
						className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
					>
						{elevenLoading ? "Генерира MP3…" : elevenPlayback ? "Възпроизвежда (ElevenLabs)…" : "Чети на глас (ElevenLabs)"}
					</button>
					<button
						type="button"
						onClick={stopSpeech}
						className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
					>
						Стоп
					</button>
					{!voicesReady && <span className="self-center text-xs text-amber-700">Зареждане на гласове…</span>}
				</div>
				{elevenErr && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{elevenErr}</p>}
				{elevenTruncated && (
					<p className="mt-2 text-xs text-amber-800">
						За ElevenLabs е използван само началото на текста (до {ELEVENLABS_MAX_CHARS} знака). За цялата лекция ползвайте браузър или разделете на части.
					</p>
				)}
				{!elevenConfigured && (
					<p className="mt-3 rounded-lg border border-amber-200/90 bg-amber-50/90 px-3 py-2 text-xs leading-relaxed text-amber-950">
						<strong>ElevenLabs</strong> е изключен — няма <code className="rounded bg-white/80 px-1">ELEVENLABS_API_KEY</code> /{" "}
						<code className="rounded bg-white/80 px-1">ELEVENLABS_VOICE_ID</code> в <code className="rounded bg-white/80 px-1">apps/web/.env.local</code>. Глас от{" "}
						<a className="font-medium underline underline-offset-2" href="https://elevenlabs.io/app/voice-library" target="_blank" rel="noreferrer">
							Voice Library
						</a>
						. След добавяне рестартирай <code className="rounded bg-white/70 px-1">npm run dev</code>.
					</p>
				)}
				<p className="mt-3 text-xs text-slate-500">
					Гласът от бутона „браузър“ е Web Speech (качеството зависи от ОС). ElevenLabs дава по-добро качество; ключът остава на сървъра през <code className="rounded bg-white/80 px-1">POST /api/elevenlabs-tts</code>.
				</p>
			</article>

			<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
				<h3 className="text-sm font-semibold text-slate-900">Въпрос към лектора (реален API)</h3>
				<p className="mt-1 text-xs text-slate-500">
					Използва се <code className="rounded bg-slate-100 px-1">POST /api/academy-tutor</code> през Next прокси → Mistral + учебен пазарен snapshot на маркетинг сървъра (порт 3456).
				</p>
				<textarea
					value={question}
					onChange={(e) => setQuestion(e.target.value)}
					rows={4}
					className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-inner outline-none focus:border-emerald-500"
				/>
				<button
					type="button"
					onClick={askTutor}
					disabled={loading || !ready}
					className="mt-3 rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
				>
					{loading ? "Изпращане…" : "Попитай лектора"}
				</button>
				{err && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{err}</p>}
				{reply && (
					<div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-900 whitespace-pre-wrap">{reply}</div>
				)}
			</section>

			<section className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-4 text-sm text-slate-700">
				<p className="font-semibold text-slate-900">Какво още може да се добави (идеи)</p>
				<ul className="mt-2 list-disc space-y-1 pl-5">
					<li>
						Нови лекции: <code className="rounded bg-white px-1">public/lectures/courses/&lt;курс&gt;/*.md</code> + ред в{" "}
						<code className="rounded bg-white px-1">src/content/academy-courses.ts</code>.
					</li>
					<li>Дълбочина: квизове, видео връзки, PDF приложения към модул.</li>
					<li>Връзка с <code className="rounded bg-white px-1">/academy/lab</code> — параметри от сценарий към симулацията.</li>
				</ul>
			</section>
		</div>
	);
}

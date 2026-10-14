import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { locale } = await params;
	return locale === "bg"
		? {
				title: "Методология · AgriNexus",
				description: "Как изчисляваме показателя за увереност и как да го четеш.",
			}
		: {
				title: "Methodology · AgriNexus",
				description: "How we estimate the confidence indicator and how to read it.",
			};
}

const copy = {
	en: {
		title: "How we estimate confidence",
		intro:
			"Each forecast in AgriNexus combines several independent signals: delayed CBOT price direction, news flow, weather indices for key regions, and FX moves (EUR/USD). Each signal has a direction (up/down) and a weight.",
		alignment:
			"The confidence indicator reflects two things: how many signals point the same way, and how strong each one is. When most signals align, confidence reads as strong. When they conflict, it reads as mixed or weak — we show that openly instead of hiding uncertainty.",
		caveat:
			"Important: a strong reading means signals are aligned today — not that the market must move that way. Agricultural markets react to events no model foresees. The indicator is for judgment, not a promise.",
		calibration:
			"The indicator is a heuristic based on how signals line up right now. We are still collecting historical data to calibrate it against real outcomes — treat it as orientation, not a precise probability.",
		back: "← Back to market intelligence",
	},
	bg: {
		title: "Как изчисляваме показателя за увереност",
		intro:
			"Всяка прогноза в AgriNexus събира няколко независими сигнала: посоката на цените на CBOT (със закъснение), новинарски поток, метеорологични индекси за ключови региони и валутни движения (EUR/USD). Всеки сигнал има посока (нагоре/надолу) и тежест.",
		alignment:
			"Показателят за увереност отразява две неща: колко от сигналите сочат в една и съща посока и колко силен е всеки от тях. Когато повечето сигнали се подреждат еднопосочно, увереността е силен сигнал. Когато се противоречат — смесен или слаб — и ние го показваме честно, вместо да крием несигурността.",
		caveat:
			"Важно: силен сигнал означава, че показателите са съгласувани днес — не че пазарът задължително ще се движи така. Пазарите на земеделски стоки реагират на събития, които никой модел не предвижда. Затова показателят е инструмент за преценка, а не обещание.",
		calibration:
			"Показателят е евристична оценка на базата на текущото подреждане на сигналите. Все още събираме исторически данни, за да го калибрираме спрямо реални резултати — затова го третирай като ориентир, не като точна вероятност.",
		back: "← Към пазарно разузнаване",
	},
};

export default async function MethodologyPage({ params }: PageProps) {
	const { locale } = await params;
	setRequestLocale(locale);
	const c = locale === "bg" ? copy.bg : copy.en;

	return (
		<main className="mx-auto max-w-2xl px-8 py-16 text-ink">
			<p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45">AgriNexus</p>
			<h1 className="mt-2 text-2xl font-semibold tracking-tight">{c.title}</h1>
			<div className="mt-6 space-y-4 text-sm leading-relaxed text-ink/75">
				<p>{c.intro}</p>
				<p>{c.alignment}</p>
				<p>{c.caveat}</p>
				<p className="rounded-lg border border-ink/10 bg-ink/[0.02] px-4 py-3 text-ink/65">{c.calibration}</p>
			</div>
			<p className="mt-10 flex flex-wrap gap-4 text-sm">
				<Link href="/market" className="text-forest-700 underline underline-offset-4">
					{c.back}
				</Link>
				<Link href="/" className="text-ink/55 underline underline-offset-4">
					{locale === "bg" ? "Начало" : "Home"}
				</Link>
			</p>
		</main>
	);
}

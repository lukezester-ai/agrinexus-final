import { Link } from "@/i18n/navigation";
import type { DecisionDiaryEntry } from "@/lib/decision-diary";
import { formatDecisionDate } from "@/lib/decision-diary";

const copy = {
	en: {
		title: "Decision diary",
		empty: "Log sell / hold / forward choices to review later.",
		cta: "Open diary →",
		add: "Log decision",
	},
	bg: {
		title: "Дневник на решения",
		empty: "Записвай продажба / задържане / форуърд за преглед по-късно.",
		cta: "Към дневника →",
		add: "Запиши решение",
	},
};

const actionLabel = {
	en: {
		sell: "Sell",
		hold: "Hold",
		forward: "Forward",
		hedge: "Hedge",
		other: "Other",
	},
	bg: {
		sell: "Продажба",
		hold: "Задържам",
		forward: "Форуърд",
		hedge: "Хедж",
		other: "Друго",
	},
};

export function DecisionDiaryTeaser({
	locale,
	entries,
}: {
	locale: string;
	entries: DecisionDiaryEntry[];
}) {
	const c = locale === "bg" ? copy.bg : copy.en;
	const labels = locale === "bg" ? actionLabel.bg : actionLabel.en;
	const recent = entries.slice(0, 2);

	return (
		<div className="rounded-2xl border border-ink/10 bg-white/55 px-5 py-4 backdrop-blur-sm">
			<div className="flex items-center justify-between gap-2 mb-3">
				<p className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink/45 m-0">
					{c.title}
				</p>
				<Link href="/dashboard/decisions" className="text-[11px] font-medium text-forest-700">
					{c.cta}
				</Link>
			</div>
			{recent.length === 0 ? (
				<p className="text-xs text-ink/55 m-0 mb-2">{c.empty}</p>
			) : (
				<ul className="space-y-2 mb-2">
					{recent.map((e) => (
						<li key={e.id} className="text-xs text-ink/70">
							<span className="font-medium text-ink">
								{labels[e.action]} · {formatDecisionDate(e.decided_at, locale)}
							</span>
							{e.rationale ? (
								<span className="block text-ink/55 truncate max-w-full">{e.rationale}</span>
							) : null}
						</li>
					))}
				</ul>
			)}
			<Link
				href="/dashboard/decisions"
				className="inline-block text-[12px] font-medium text-forest-700 underline underline-offset-2"
			>
				{c.add}
			</Link>
		</div>
	);
}

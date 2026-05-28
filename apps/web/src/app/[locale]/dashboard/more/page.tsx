import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { locale } = await params;
	return locale === "bg" ? { title: "Още" } : { title: "More" };
}

const items = {
	en: [
		{ href: "/dashboard/decisions", icon: "📓", label: "Decision diary", sub: "Log sell / hold choices" },
		{ href: "/dashboard/settings", icon: "⚙️", label: "Settings", sub: "Profile, break-even, briefing" },
		{ href: "/community", icon: "👥", label: "AI Community", sub: "Farmer's table + agents" },
		{ href: "/agents", icon: "🤖", label: "18 Agents", sub: "Agent mesh overview" },
		{ href: "/academy", icon: "🎓", label: "Academy", sub: "Courses and lab" },
		{ href: "/", icon: "🏡", label: "Marketing home", sub: "Public site" },
	],
	bg: [
		{ href: "/dashboard/decisions", icon: "📓", label: "Дневник на решения", sub: "Продажба / задържане" },
		{ href: "/dashboard/settings", icon: "⚙️", label: "Настройки", sub: "Профил, себестойност, briefing" },
		{ href: "/community", icon: "👥", label: "AI Community", sub: "Масата + агенти" },
		{ href: "/agents", icon: "🤖", label: "18 агента", sub: "Преглед на мрежата" },
		{ href: "/academy", icon: "🎓", label: "Академия", sub: "Курсове и лаборатория" },
		{ href: "/", icon: "🏡", label: "Начална страница", sub: "Публичен сайт" },
	],
};

export default async function DashboardMorePage({ params }: PageProps) {
	const { locale } = await params;
	setRequestLocale(locale);
	const list = locale === "bg" ? items.bg : items.en;
	const title = locale === "bg" ? "Още" : "More";

	return (
		<div className="px-4 py-4 pb-6">
			<h1 className="font-serif text-2xl text-ink mb-4">{title}</h1>
			<ul className="flex flex-col gap-2">
				{list.map((item) => (
					<li key={item.href}>
						<Link
							href={item.href}
							className="flex items-center gap-3 rounded-2xl border border-ink/[0.06] bg-white/55 px-4 py-3.5 no-underline backdrop-blur-sm active:bg-white/80"
						>
							<span className="text-xl" aria-hidden>
								{item.icon}
							</span>
							<span className="min-w-0 flex-1">
								<span className="block text-sm font-medium text-ink">{item.label}</span>
								<span className="block text-xs text-ink/50">{item.sub}</span>
							</span>
							<span className="text-ink/30">›</span>
						</Link>
					</li>
				))}
			</ul>
		</div>
	);
}

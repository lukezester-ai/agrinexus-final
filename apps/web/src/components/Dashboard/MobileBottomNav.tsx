"use client";

import { Link, usePathname } from "@/i18n/navigation";

const copy = {
	en: {
		home: "Today",
		fields: "Fields",
		market: "Market",
		ask: "Ask",
		more: "More",
	},
	bg: {
		home: "Днес",
		fields: "Поля",
		market: "Пазар",
		ask: "Питай",
		more: "Още",
	},
};

type Tab = {
	href: string;
	icon: string;
	labelKey: keyof (typeof copy)["en"];
	match: (path: string) => boolean;
};

const tabs: Tab[] = [
	{
		href: "/dashboard",
		icon: "🏠",
		labelKey: "home",
		match: (p) => p === "/dashboard" || p === "/",
	},
	{
		href: "/dashboard/fields",
		icon: "📋",
		labelKey: "fields",
		match: (p) => p.startsWith("/dashboard/fields"),
	},
	{
		href: "/dashboard/market",
		icon: "📈",
		labelKey: "market",
		match: (p) => p.startsWith("/dashboard/market"),
	},
	{
		href: "/dashboard/ask",
		icon: "💬",
		labelKey: "ask",
		match: (p) => p.startsWith("/dashboard/ask"),
	},
	{
		href: "/dashboard/more",
		icon: "⋯",
		labelKey: "more",
		match: (p) =>
			p.startsWith("/dashboard/more") ||
			p.startsWith("/dashboard/settings") ||
			p.startsWith("/dashboard/decisions"),
	},
];

export function MobileBottomNav({ locale }: { locale: string }) {
	const c = locale === "bg" ? copy.bg : copy.en;
	const pathname = usePathname() ?? "";

	return (
		<nav
			className="fixed inset-x-0 bottom-0 z-50 border-t border-ink/[0.08] bg-paper/95 backdrop-blur-xl md:hidden"
			style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
			aria-label={locale === "bg" ? "Мобилна навигация" : "Mobile navigation"}
		>
			<div className="grid grid-cols-5">
				{tabs.map((tab) => {
					const active = tab.match(pathname);
					return (
						<Link
							key={tab.href}
							href={tab.href}
							className={`flex flex-col items-center gap-0.5 py-2.5 no-underline transition-colors ${
								active ? "text-forest-800" : "text-ink/45"
							}`}
						>
							<span className="text-[20px] leading-none" aria-hidden>
								{tab.icon}
							</span>
							<span
								className={`text-[10px] leading-tight ${active ? "font-semibold" : "font-medium"}`}
							>
								{c[tab.labelKey]}
							</span>
						</Link>
					);
				})}
			</div>
		</nav>
	);
}

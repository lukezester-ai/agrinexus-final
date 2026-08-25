"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { productLocale, shellCopy } from "@/lib/product-ux-copy";

type Tab = {
	href: string;
	icon: string;
	labelKey: "radar" | "intents" | "askShort" | "more";
	match: (path: string) => boolean;
};

const tabs: Tab[] = [
	{
		href: "/dashboard",
		icon: "🏠",
		labelKey: "radar",
		match: (p) => p === "/dashboard" || p === "/",
	},
	{
		href: "/dashboard/intents",
		icon: "◎",
		labelKey: "intents",
		match: (p) => p.startsWith("/dashboard/intents"),
	},
	{
		href: "/dashboard/ask",
		icon: "💬",
		labelKey: "askShort",
		match: (p) => p.startsWith("/dashboard/ask"),
	},
	{
		href: "/dashboard/settings",
		icon: "⚙",
		labelKey: "more",
		match: (p) => p.startsWith("/dashboard/settings"),
	},
	{
		href: "/dashboard/more",
		icon: "⋯",
		labelKey: "more",
		match: (p) => p.startsWith("/dashboard/more"),
	},
];

export function MobileBottomNav({ locale }: { locale: string }) {
	const c = shellCopy[productLocale(locale)];
	const pathname = usePathname() ?? "";

	return (
		<nav
			className="fixed inset-x-0 bottom-0 z-50 border-t border-ink/[0.08] bg-paper/95 backdrop-blur-xl md:hidden"
			style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
			aria-label={c.navAria}
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

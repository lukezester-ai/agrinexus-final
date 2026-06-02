"use client";

import { useState } from "react";
import { Bot, GraduationCap, Heart, Leaf, LineChart, Menu, Users, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/language-switcher";

type NavProps = {
	active?: "platform" | "market" | "agents" | "academy" | "community" | "sponsors";
};

const keys: {
	href: string;
	labelKey: "platform" | "market" | "agents" | "academy" | "community" | "sponsors";
	navKey: NonNullable<NavProps["active"]>;
	icon: typeof Leaf;
	avatarClass: string;
}[] = [
	{
		href: "/platform",
		labelKey: "platform",
		navKey: "platform",
		icon: Leaf,
		avatarClass: "bg-gradient-to-br from-forest-200 to-forest-700 text-white",
	},
	{
		href: "/market",
		labelKey: "market",
		navKey: "market",
		icon: LineChart,
		avatarClass: "bg-gradient-to-br from-harvest-200 to-forest-800 text-white",
	},
	{
		href: "/agents",
		labelKey: "agents",
		navKey: "agents",
		icon: Bot,
		avatarClass: "bg-gradient-to-br from-forest-200 via-[#c4b5fd] to-forest-900 text-white",
	},
	{
		href: "/academy",
		labelKey: "academy",
		navKey: "academy",
		icon: GraduationCap,
		avatarClass: "bg-gradient-to-br from-harvest-50 to-harvest-700 text-forest-900",
	},
	{
		href: "/community",
		labelKey: "community",
		navKey: "community",
		icon: Users,
		avatarClass: "bg-gradient-to-br from-violet-200 to-forest-800 text-white",
	},
	{
		href: "/sponsors",
		labelKey: "sponsors",
		navKey: "sponsors",
		icon: Heart,
		avatarClass: "bg-gradient-to-br from-harvest-200 to-semantic-alert text-white",
	},
];

export function Nav({ active }: NavProps) {
	const t = useTranslations("Nav");
	const [isOpen, setIsOpen] = useState(false);

	return (
		<header className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-3 sm:px-4">
			<nav
				className="pointer-events-auto flex w-full max-w-5xl items-center justify-between gap-2 rounded-2xl border border-ink/[0.08] bg-paper/70 px-3 py-2.5 shadow-[0_12px_48px_rgba(14,40,24,0.12)] ring-1 ring-white/60 backdrop-blur-2xl sm:gap-3 sm:px-5 sm:py-3"
				aria-label="Main"
			>
				<Link
					href="/"
					className="group flex min-w-0 shrink items-center gap-2 rounded-xl px-1 py-0.5 text-sm font-medium text-ink no-underline transition-all duration-300 ease-out hover:scale-[1.02] hover:bg-white/50 active:scale-[0.99] md:shrink-0"
					onClick={() => setIsOpen(false)}
				>
					<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-gradient text-[12px] text-white shadow-[0_2px_10px_rgba(31,77,44,0.25)] transition-shadow duration-300 ease-out group-hover:shadow-md sm:h-8 sm:w-8 sm:text-[13px]">
						✦
					</span>
					<span className="truncate sm:max-w-none">AgriNexus</span>
				</Link>

				<div className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 text-[13px] lg:flex lg:gap-1">
					{keys.map((l) => {
						const Icon = l.icon;
						const isActive = active === l.navKey;
						return (
							<Link
								key={l.navKey}
								href={l.href}
								className={`group flex items-center gap-2 rounded-xl px-2 py-1.5 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-white/70 hover:shadow-sm active:translate-y-0 lg:px-2.5 lg:py-2 ${
									isActive ? "bg-white/80 shadow-sm ring-1 ring-ink/[0.06]" : ""
								}`}
							>
								<span
									className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full shadow-inner ring-2 ring-white/90 transition-transform duration-300 ease-out group-hover:scale-110 group-hover:rotate-3 sm:h-8 sm:w-8 ${l.avatarClass}`}
								>
									<Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={2} aria-hidden />
								</span>
								<span
									className={
										isActive ? "font-semibold text-ink" : "text-ink/65 transition-colors duration-200 group-hover:text-ink"
									}
								>
									{t(l.labelKey)}
								</span>
							</Link>
						);
					})}
				</div>

				<div className="flex shrink-0 items-center gap-2 sm:gap-3">
					<LanguageSwitcher />
					<Link
						href="/dashboard"
						className="inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-[11px] font-medium text-white shadow-md transition-all duration-300 ease-out hover:scale-[1.03] hover:bg-ink/90 hover:shadow-lg active:scale-[0.98] sm:px-4 sm:py-2 sm:text-xs"
					>
						{t("joinFree")}
					</Link>
					<button
						type="button"
						className="flex items-center justify-center rounded-lg p-1.5 text-ink/70 hover:bg-white/50 hover:text-ink lg:hidden"
						onClick={() => setIsOpen(!isOpen)}
						aria-label="Toggle menu"
					>
						{isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
					</button>
				</div>
			</nav>

			{isOpen && (
				<div className="pointer-events-auto absolute inset-x-3 top-[calc(100%+0.5rem)] mx-auto max-w-5xl rounded-2xl border border-ink/[0.08] bg-paper/95 p-3 shadow-xl backdrop-blur-3xl sm:inset-x-4 lg:hidden">
					<div className="flex flex-col gap-1">
						{keys.map((l) => {
							const Icon = l.icon;
							const isActive = active === l.navKey;
							return (
								<Link
									key={l.navKey}
									href={l.href}
									onClick={() => setIsOpen(false)}
									className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
										isActive ? "bg-white/80 font-semibold text-ink shadow-sm ring-1 ring-ink/[0.06]" : "text-ink/70 hover:bg-white/50 hover:text-ink"
									}`}
								>
									<span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-inner ring-1 ring-white/60 ${l.avatarClass}`}>
										<Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
									</span>
									<span>{t(l.labelKey)}</span>
								</Link>
							);
						})}
					</div>
				</div>
			)}
		</header>
	);
}

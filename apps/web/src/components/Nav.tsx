"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/language-switcher";

type NavProps = {
	active?: "platform" | "market" | "agents" | "academy" | "sponsors";
};

const keys: { href: string; labelKey: "platform" | "market" | "agents" | "academy" | "sponsors"; navKey: NonNullable<NavProps["active"]> }[] = [
	{ href: "/platform", labelKey: "platform", navKey: "platform" },
	{ href: "/market", labelKey: "market", navKey: "market" },
	{ href: "/agents", labelKey: "agents", navKey: "agents" },
	{ href: "/academy", labelKey: "academy", navKey: "academy" },
	{ href: "/sponsors", labelKey: "sponsors", navKey: "sponsors" },
];

export function Nav({ active }: NavProps) {
	const t = useTranslations("Nav");

	return (
		<nav className="sticky top-0 z-50 flex items-center justify-between border-b border-ink/[0.05] bg-paper/65 px-8 py-4 backdrop-blur-xl">
			<Link href="/" className="flex items-center gap-2.5 text-sm font-medium text-ink no-underline">
				<span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-gradient text-[13px] text-white shadow-[0_2px_10px_rgba(31,77,44,0.25)]">
					✦
				</span>
				<span>AgriNexus</span>
			</Link>

			<div className="hidden gap-6 text-[13px] md:flex">
				{keys.map((l) => (
					<Link
						key={l.navKey}
						href={l.href}
						className={
							active === l.navKey
								? "font-medium text-ink"
								: "text-ink/60 transition-colors hover:text-ink"
						}
					>
						{t(l.labelKey)}
					</Link>
				))}
			</div>

			<div className="flex items-center gap-3">
				<LanguageSwitcher />
				<Link
					href="/dashboard"
					className="inline-flex items-center gap-1 rounded-full bg-ink px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-ink/90"
				>
					{t("joinFree")}
				</Link>
			</div>
		</nav>
	);
}

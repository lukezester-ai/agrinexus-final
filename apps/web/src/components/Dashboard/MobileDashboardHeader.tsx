"use client";

import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/language-switcher";
import { productLocale, shellCopy } from "@/lib/product-ux-copy";

type Props = {
	locale: string;
	userName: string;
	initials: string;
	unreadNotifications: number;
};

export function MobileDashboardHeader({ locale, userName, initials, unreadNotifications }: Props) {
	const firstName = userName.split(/\s+/)[0] || userName;

	return (
		<header
			className="sticky top-0 z-40 flex items-center justify-between border-b border-white/10 bg-[#141618] px-4 py-3 md:hidden"
			style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
		>
			<Link href="/dashboard" className="no-underline">
				<div className="text-[11px] tracking-[0.22em] text-[#8fbf9a]">AGRI NEXUS</div>
			</Link>
			<div className="flex items-center gap-3">
				<Link
					href="/dashboard/notifications"
					className="relative text-[12px] text-white/70 no-underline hover:text-white"
					aria-label={shellCopy[productLocale(locale)].notifications}
				>
					{shellCopy[productLocale(locale)].notifications}
					{unreadNotifications ? <span className="ms-1 text-[#e2b657]">{unreadNotifications}</span> : null}
				</Link>
				<LanguageSwitcher tone="dark" />
				<Link href="/dashboard/settings" className="text-[12px] text-white/70 no-underline hover:text-white" title={firstName}>
					{initials}
				</Link>
			</div>
		</header>
	);
}

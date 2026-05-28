"use client";

import { Link } from "@/i18n/navigation";

type Props = {
	locale: string;
	userName: string;
	initials: string;
};

export function MobileDashboardHeader({ locale, userName, initials }: Props) {
	const firstName = userName.split(/\s+/)[0] || userName;

	return (
		<header
			className="sticky top-0 z-40 flex items-center justify-between border-b border-ink/[0.06] bg-paper/90 px-4 py-3 backdrop-blur-xl md:hidden"
			style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
		>
			<Link href="/" className="flex items-center gap-2 no-underline text-ink">
				<span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-gradient text-[11px] text-white">
					✦
				</span>
				<span className="text-sm font-medium">AgriNexus</span>
			</Link>
			<div className="flex items-center gap-2">
				<Link
					href="/dashboard/ask"
					className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/[0.08] bg-white/70 text-base no-underline"
					aria-label={locale === "bg" ? "Чат" : "Chat"}
				>
					💬
				</Link>
				<Link
					href="/dashboard/settings"
					className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-harvest-500 to-earth-600 text-[11px] font-medium text-white no-underline"
					title={firstName}
				>
					{initials}
				</Link>
			</div>
		</header>
	);
}

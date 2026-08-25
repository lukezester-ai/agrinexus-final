"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/language-switcher";
import { productLocale, shellCopy } from "@/lib/product-ux-copy";
import { WORKING_PRODUCT_MARK, WORKING_PRODUCT_NAME } from "@/lib/product-identity";

function SidebarGroup({ label, items }: { label: string; items: { icon: string; label: string; href: string; active?: boolean }[] }) {
	return (
		<div className="flex flex-col gap-0.5">
			<div className="px-2 pb-1.5 text-[9px] uppercase tracking-[0.1em] text-ink/40">{label}</div>
			{items.map((item) => (
				<Link
					key={item.href}
					href={item.href}
					className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] no-underline transition-colors ${
						item.active ? "bg-ink/[0.06] font-medium text-ink" : "text-ink/65 hover:bg-ink/[0.04]"
					}`}
				>
					<span>{item.icon}</span>
					<span>{item.label}</span>
				</Link>
			))}
		</div>
	);
}

export default function Sidebar({
	locale,
	initials,
	userName,
	userMeta,
}: {
	locale: string;
	initials: string;
	userName: string;
	userMeta: string;
}) {
	const c = shellCopy[productLocale(locale)];
	const pathname = usePathname();

	const items = [
		{ icon: "◎", label: c.radar, href: "/dashboard", active: pathname === "/dashboard" },
		{ icon: "◎", label: c.intents, href: "/dashboard/intents", active: pathname.startsWith("/dashboard/intents") },
		{ icon: "◎", label: c.opportunities, href: "/dashboard/opportunities", active: pathname.startsWith("/dashboard/opportunities") },
		{ icon: "◎", label: c.start, href: "/dashboard/onboarding", active: pathname.startsWith("/dashboard/onboarding") },
		{ icon: "⚙", label: c.settings, href: "/dashboard/settings", active: pathname === "/dashboard/settings" },
	];

	return (
		<aside className="sticky top-0 hidden h-screen w-[220px] flex-shrink-0 flex-col gap-4 border-e border-ink/[0.06] bg-paper/85 px-3.5 py-5 backdrop-blur-xl md:flex">
			<Link href="/dashboard" className="flex items-center gap-2 px-1.5 py-1 pb-3 text-ink no-underline">
				<span className="flex h-[22px] w-[22px] items-center justify-center rounded-md bg-brand-gradient text-xs text-white shadow-[0_2px_8px_rgba(31,77,44,0.25)]">{WORKING_PRODUCT_MARK}</span>
				<span className="text-[13px] font-medium">{WORKING_PRODUCT_NAME}</span>
			</Link>
			<SidebarGroup label={c.daily} items={items} />
			<div className="mt-auto flex flex-col gap-3">
				<LanguageSwitcher />
				<div className="flex items-center gap-2.5 rounded-[10px] bg-white/50 p-3 px-2">
					<div className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-harvest-500 to-earth-600 text-xs font-medium text-white">{initials}</div>
					<div><div className="text-xs font-medium">{userName}</div><div className="text-[10px] text-ink/50">{userMeta}</div></div>
				</div>
			</div>
		</aside>
	);
}

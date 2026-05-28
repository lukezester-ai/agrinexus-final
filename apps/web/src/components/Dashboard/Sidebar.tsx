"use client";

import { Link, usePathname } from "@/i18n/navigation";

const copy = {
	en: {
		daily: "Daily",
		mesh: "Mesh",
		more: "More",
		items: {
			briefing: "Briefing",
			fields: "Fields",
			market: "Market",
			decisions: "Decision diary",
			finance: "Finance",
			agents: "Agents",
			ask: "Ask AgriNexus",
			academy: "Academy",
			community: "AI Community",
			settings: "Settings",
		},
	},
	bg: {
		daily: "Дневно",
		mesh: "Мрежа",
		more: "Още",
		items: {
			briefing: "Обзор",
			fields: "Поля",
			market: "Пазар",
			decisions: "Решения",
			finance: "Финанси",
			agents: "Агенти",
			ask: "Попитай AgriNexus",
			academy: "Академия",
			community: "AI Community",
			settings: "Настройки",
		},
	},
};

function SidebarGroup({ label, items }: { label: string; items: { icon: string; label: string; href: string; active?: boolean; badge?: string }[] }) {
	return (
		<div className="flex flex-col gap-0.5">
			<div className="px-2 pb-1.5 text-[9px] uppercase tracking-[0.1em] text-ink/40">{label}</div>
			{items.map((item) => (
				<Link
					key={item.label}
					href={item.href}
					className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] no-underline transition-colors ${
						item.active ? "bg-ink/[0.06] font-medium text-ink" : "text-ink/65 hover:bg-ink/[0.04]"
					}`}
				>
					<span>{item.icon}</span>
					<span>{item.label}</span>
					{item.badge && <span className="ml-auto rounded-full bg-forest-700/10 px-1.5 py-px font-mono text-[9px] font-medium text-forest-700">{item.badge}</span>}
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
	const c = locale === "bg" ? copy.bg : copy.en;
	const pathname = usePathname();

	const sideItems = {
		daily: [
			{ icon: "🏠", label: c.items.briefing, href: "/dashboard", active: pathname === "/dashboard" || pathname === "/" },
			{ icon: "📋", label: c.items.fields, href: "/dashboard/fields", active: pathname === "/dashboard/fields" },
			{ icon: "📈", label: c.items.market, href: "/dashboard/market", active: pathname === "/dashboard/market" },
			{ icon: "📓", label: c.items.decisions, href: "/dashboard/decisions", active: pathname === "/dashboard/decisions" },
			{ icon: "💰", label: c.items.finance, href: "#" },
		],
		mesh: [
			{ icon: "🤖", label: c.items.agents, href: "/agents", active: pathname === "/agents", badge: "18" },
			{ icon: "💬", label: c.items.ask, href: "/dashboard/ask", active: pathname === "/dashboard/ask" },
		],
		more: [
			{ icon: "🎓", label: c.items.academy, href: "/academy", active: pathname === "/academy" },
			{ icon: "👥", label: c.items.community, href: "/community", active: pathname === "/community" },
			{ icon: "⚙", label: c.items.settings, href: "/dashboard/settings", active: pathname === "/dashboard/settings" },
		],
	};

	return (
		<aside className="sticky top-0 hidden h-screen w-[220px] flex-shrink-0 flex-col gap-4 border-r border-ink/[0.06] bg-paper/85 px-3.5 py-5 backdrop-blur-xl md:flex">
			<Link href="/" className="flex items-center gap-2 px-1.5 py-1 pb-3 text-ink no-underline">
				<span className="flex h-[22px] w-[22px] items-center justify-center rounded-md bg-brand-gradient text-xs text-white shadow-[0_2px_8px_rgba(31,77,44,0.25)]">✦</span>
				<span className="text-[13px] font-medium">AgriNexus</span>
			</Link>
			<SidebarGroup label={c.daily} items={sideItems.daily} />
			<SidebarGroup label={c.mesh} items={sideItems.mesh} />
			<SidebarGroup label={c.more} items={sideItems.more} />
			<div className="mt-auto flex items-center gap-2.5 rounded-[10px] bg-white/50 p-3 px-2">
				<div className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-harvest-500 to-earth-600 text-xs font-medium text-white">{initials}</div>
				<div><div className="text-xs font-medium">{userName}</div><div className="text-[10px] text-ink/50">{userMeta}</div></div>
			</div>
		</aside>
	);
}

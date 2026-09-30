import { Link } from "@/i18n/navigation";
import { productLocale } from "@/lib/product-ux-copy";

const NAV = [
	{ href: "/", label: "Home" },
	{ href: "/business-radar", label: "Business Radar" },
	{ href: "/finance-intelligence", label: "Finance Intelligence" },
	{ href: "/strategy-copilot", label: "AI Strategy Copilot" },
	{ href: "/risk-governance", label: "Risk & Governance" },
	{ href: "/execution-safety", label: "Execution Safety" },
] as const;

type Copy = {
	line: string;
	blocked: string;
	stages: { id: string; title: string; href?: string }[];
};

const copy: Record<"en" | "bg" | "ar", Copy> = {
	en: {
		line: "From business intent to governed decision.",
		blocked: "LIVE EXECUTION: BLOCKED",
		stages: [
			{ id: "intent", title: "Intent" },
			{ id: "intelligence", title: "Business Intelligence" },
			{ id: "radar", title: "Business Radar", href: "/business-radar" },
			{ id: "finance", title: "Finance Intelligence", href: "/finance-intelligence" },
			{ id: "copilot", title: "AI Strategy Copilot", href: "/strategy-copilot" },
			{ id: "risk", title: "Risk & Governance", href: "/risk-governance" },
			{ id: "safety", title: "Execution Safety", href: "/execution-safety" },
			{ id: "stop", title: "STOP" },
		],
	},
	bg: {
		line: "От бизнес намерение към управлявано решение.",
		blocked: "LIVE EXECUTION: BLOCKED",
		stages: [
			{ id: "intent", title: "Намерение" },
			{ id: "intelligence", title: "Business Intelligence" },
			{ id: "radar", title: "Business Radar", href: "/business-radar" },
			{ id: "finance", title: "Finance Intelligence", href: "/finance-intelligence" },
			{ id: "copilot", title: "AI Strategy Copilot", href: "/strategy-copilot" },
			{ id: "risk", title: "Risk & Governance", href: "/risk-governance" },
			{ id: "safety", title: "Execution Safety", href: "/execution-safety" },
			{ id: "stop", title: "STOP" },
		],
	},
	ar: {
		line: "From business intent to governed decision.",
		blocked: "LIVE EXECUTION: BLOCKED",
		stages: [
			{ id: "intent", title: "Intent" },
			{ id: "intelligence", title: "Business Intelligence" },
			{ id: "radar", title: "Business Radar", href: "/business-radar" },
			{ id: "finance", title: "Finance Intelligence", href: "/finance-intelligence" },
			{ id: "copilot", title: "AI Strategy Copilot", href: "/strategy-copilot" },
			{ id: "risk", title: "Risk & Governance", href: "/risk-governance" },
			{ id: "safety", title: "Execution Safety", href: "/execution-safety" },
			{ id: "stop", title: "STOP" },
		],
	},
};

export function isPublicPath(pathname: string): boolean {
	return (
		pathname === "/" ||
		pathname.startsWith("/business-radar") ||
		pathname.startsWith("/finance-intelligence") ||
		pathname.startsWith("/strategy-copilot") ||
		pathname.startsWith("/risk-governance") ||
		pathname.startsWith("/execution-safety") ||
		pathname.startsWith("/login") ||
		pathname.startsWith("/privacy")
	);
}

export function PublicHeader({ locale }: { locale: string }) {
	return (
		<header className="border-b border-white/10">
			<div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-6 md:px-10">
				<Link href="/" className="w-fit text-white no-underline">
					<div className="text-[11px] tracking-[0.22em] text-[#8fbf9a]">AGRI NEXUS</div>
					<div className="mt-1 text-sm text-white/90">Universal Business Core</div>
				</Link>
				<nav className="flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-white/70" aria-label="Public">
					{NAV.map((item) => (
						<Link key={item.href} href={item.href} className="no-underline hover:text-white">
							{item.label}
						</Link>
					))}
				</nav>
			</div>
		</header>
	);
}

export function PublicShell({ locale, children }: { locale: string; children: React.ReactNode }) {
	return (
		<div className="relative z-[2] flex min-h-screen flex-col bg-[#141618] text-white">
			<PublicHeader locale={locale} />
			<div className="flex-1">{children}</div>
			<footer className="border-t border-white/10 px-6 py-6 text-[12px] text-white/45 md:px-10">
				<Link href="/privacy" className="no-underline hover:text-white">
					{productLocale(locale) === "bg" ? "Поверителност" : "Privacy"}
				</Link>
			</footer>
		</div>
	);
}

export function HomeFlow({ locale }: { locale: string }) {
	const c = copy[productLocale(locale)];
	const byId = Object.fromEntries(c.stages.map((stage) => [stage.id, stage]));
	return (
		<main className="mx-auto max-w-6xl px-6 py-16 md:px-10 md:py-24">
			<p className="text-[11px] tracking-[0.22em] text-white/45">BUSINESS INTELLIGENCE & DECISION INFRASTRUCTURE</p>
			<h1 className="mt-6 max-w-3xl text-4xl font-light leading-tight text-white md:text-6xl">{c.line}</h1>
			<ol className="mt-20 flex max-w-xl flex-col gap-0 border-s border-white/15 ps-8">
				<Stage stage={byId.intent} />
				<Stage stage={byId.intelligence} />
				<li className="grid gap-6 py-4 md:grid-cols-2">
					<StageCard stage={byId.radar} />
					<StageCard stage={byId.finance} />
				</li>
				<Stage stage={byId.copilot} />
				<Stage stage={byId.risk} />
				<Stage stage={byId.safety} />
				<li className="pt-2 text-sm tracking-[0.18em] text-[#e2b657]">{byId.stop.title}</li>
			</ol>
			<p className="mt-10 text-sm tracking-[0.14em] text-[#e2b657]">{c.blocked}</p>
		</main>
	);
}

const stageButton =
	"block border border-white/15 px-4 py-5 text-sm text-white/85 no-underline hover:border-white/40";

function Stage({ stage }: { stage: Copy["stages"][number] }) {
	return (
		<li className="py-3">
			{stage.href ? (
				<Link href={stage.href} className={stageButton}>
					{stage.title}
				</Link>
			) : (
				<span className="text-sm text-white/85">{stage.title}</span>
			)}
		</li>
	);
}

function StageCard({ stage }: { stage: Copy["stages"][number] }) {
	return (
		<Link href={stage.href ?? "/"} className={stageButton}>
			{stage.title}
		</Link>
	);
}

type ChainStep = string | { label: string; href?: string };

function chainStep(step: ChainStep): { label: string; href?: string } {
	return typeof step === "string" ? { label: step } : step;
}

export function DirectionPage({
	locale,
	kicker,
	title,
	chain,
	boundary,
}: {
	locale: string;
	kicker: string;
	title: string;
	chain: ChainStep[];
	boundary: string[];
}) {
	const c = copy[productLocale(locale)];
	return (
		<PublicShell locale={locale}>
			<main className="mx-auto max-w-6xl px-6 py-16 md:px-10 md:py-24">
				<Link href="/" className="text-[11px] tracking-[0.22em] text-[#8fbf9a] no-underline hover:text-white">
					{kicker}
				</Link>
				<h1 className="mt-4 text-4xl font-light text-white md:text-5xl">{title}</h1>
				<ol className="mt-16 flex max-w-xl flex-col border-s border-white/15 ps-8">
					{chain.map((item) => {
						const step = chainStep(item);
						return (
							<li key={step.label} className="py-3">
								{step.href ? (
									<Link href={step.href} className={stageButton}>
										{step.label}
									</Link>
								) : (
									<span className="text-sm text-white/85">{step.label}</span>
								)}
							</li>
						);
					})}
				</ol>
				<div className="mt-12 max-w-xl space-y-2 text-sm text-[#e2b657]">
					{boundary.map((line) => (
						<p key={line}>{line}</p>
					))}
				</div>
				<Link href="/execution-safety" className="mt-10 inline-block text-sm tracking-[0.14em] text-[#e2b657] no-underline hover:text-white">
					{c.blocked}
				</Link>
			</main>
		</PublicShell>
	);
}

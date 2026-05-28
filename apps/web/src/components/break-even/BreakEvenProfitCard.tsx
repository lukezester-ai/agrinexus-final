import { Link } from "@/i18n/navigation";
import {
	type BreakEvenInputs,
	cbotPriceStrToEurPerTonne,
	formatEur,
	profitAtPrice,
} from "@/lib/break-even";
import {
	formatBasisEur,
	formatBgn,
	quoteToEurPerTonne,
	resolveMarketEurPerTonne,
} from "@/lib/local-price";

type Props = {
	locale: string;
	inputs: BreakEvenInputs | null;
	totalHa: number;
	/** Desk wheat row price string, e.g. $5.12/bu */
	wheatPriceStr?: string;
};

const copy = {
	en: {
		title: "Your margin today",
		noData: "Add your costs in Settings to see profit per tonne and for your whole farm.",
		settings: "Set break-even →",
		atPrice: "At price",
		perTonne: "per tonne",
		forFarm: "for your farm",
		breakEven: "Break-even",
		cbotNote: "Price from CBOT reference (approx. €/t). Add local buyers in settings.",
		localNote: (name: string) => `Using quote from ${name}.`,
		basis: "Basis vs CBOT",
		bgn: "BGN quote",
		loss: "below break-even",
	},
	bg: {
		title: "Твоята печалба днес",
		noData: "Добави разходите в Настройки, за да видиш печалба на тон и за цялото стопанство.",
		settings: "Въведи себестойност →",
		atPrice: "При цена",
		perTonne: "на тон",
		forFarm: "за стопанството",
		breakEven: "Себестойност",
		cbotNote: "Цена от CBOT референция (прибл. €/t). Добави купувачи в настройки.",
		localNote: (name: string) => `Оферта: ${name}.`,
		basis: "Basis спрямо CBOT",
		bgn: "Оферта в лв",
		loss: "под себестойност",
	},
};

export function BreakEvenProfitCard({ locale, inputs, totalHa, wheatPriceStr }: Props) {
	const c = locale === "bg" ? copy.bg : copy.en;

	if (!inputs) {
		return (
			<div className="rounded-2xl border border-harvest-500/25 bg-harvest-500/10 px-5 py-4">
				<p className="text-sm font-medium text-ink m-0">{c.title}</p>
				<p className="text-xs text-ink/60 mt-1 mb-3">{c.noData}</p>
				<Link href="/dashboard/settings" className="text-sm font-medium text-forest-700 underline underline-offset-2">
					{c.settings}
				</Link>
			</div>
		);
	}

	const cbotEur = wheatPriceStr ? cbotPriceStrToEurPerTonne(wheatPriceStr) : null;
	const resolved = resolveMarketEurPerTonne(inputs, cbotEur);
	const marketEur = resolved.eurPerTonne;

	if (marketEur == null) {
		return (
			<div className="rounded-2xl border border-ink/10 bg-white/55 px-5 py-4">
				<p className="text-sm text-ink/60 m-0">{c.cbotNote}</p>
				<Link href="/dashboard/settings" className="mt-2 inline-block text-sm text-forest-700 underline">
					{c.settings}
				</Link>
			</div>
		);
	}

	const result = profitAtPrice(marketEur, inputs, totalHa || 0);
	if (!result) return null;

	const positive = result.marginPerTonne >= 0;
	const priceNote =
		resolved.source === "buyer" && resolved.buyer
			? c.localNote(resolved.buyer.name)
			: resolved.source === "legacy"
				? c.localNote(locale === "bg" ? "Местна оферта" : "Local quote")
				: c.cbotNote;

	return (
		<div
			className={`rounded-2xl border px-5 py-4 ${
				positive ? "border-forest-700/20 bg-forest-700/[0.07]" : "border-semantic-alert/25 bg-semantic-alert/5"
			}`}
		>
			<p className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink/45 m-0">{c.title}</p>
			<p className="text-[10px] text-ink/45 mt-1 mb-3 leading-snug">{priceNote}</p>

			<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
				<span className="text-sm text-ink/60">{c.atPrice}</span>
				<span className="font-serif text-2xl text-ink">{formatEur(marketEur, locale)}/t</span>
			</div>

			<div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
				<div>
					<div className="text-xs text-ink/55">{c.perTonne}</div>
					<div
						className={`font-serif text-xl ${positive ? "text-semantic-success" : "text-semantic-alert"}`}
					>
						{positive ? "+" : ""}
						{formatEur(result.marginPerTonne, locale)}/t
						{!positive ? (
							<span className="ml-1 text-xs font-sans text-ink/50">({c.loss})</span>
						) : null}
					</div>
				</div>
				{totalHa > 0 ? (
					<div>
						<div className="text-xs text-ink/55">{c.forFarm}</div>
						<div
							className={`font-serif text-xl ${positive ? "text-semantic-success" : "text-semantic-alert"}`}
						>
							{positive ? "+" : ""}
							{formatEur(result.totalFarmEur, locale)}
						</div>
					</div>
				) : null}
			</div>

			{resolved.basisEur != null && resolved.source !== "cbot" ? (
				<p className="mt-2 text-[11px] text-ink/55 m-0">
					{c.basis}:{" "}
					<span className="font-mono font-medium">{formatBasisEur(resolved.basisEur, locale)}</span>
				</p>
			) : null}
			{resolved.buyer?.currency === "BGN" && resolved.buyer.price > 0 ? (
				<p className="mt-1 text-[11px] text-ink/45 m-0">
					{c.bgn}: {formatBgn(resolved.buyer.price, locale)}/t →{" "}
					{formatEur(quoteToEurPerTonne(resolved.buyer.price, "BGN"), locale)}/t
				</p>
			) : null}
			<p className="mt-3 text-[11px] text-ink/45 m-0">
				{c.breakEven}: {formatEur(result.breakEvenEurPerTonne, locale)}/t
			</p>
		</div>
	);
}

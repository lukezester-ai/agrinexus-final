import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { locale } = await params;
	return locale === "bg"
		? {
				title: "Вход · AgriNexus",
				description: "Скелет за вход в AgriNexus.",
			}
		: {
				title: "Login · AgriNexus",
				description: "Auth skeleton — no real session yet",
			};
}

const copy = {
	en: {
		kicker: "AgriNexus · apps/web",
		title: "Login (skeleton)",
		body: "Placeholder for OAuth / email magic link. Wire to",
		bodyTail: "when auth exists.",
		groupLabel: "Login fields (skeleton)",
		email: "Email",
		placeholder: "you@farm.example",
		continue: "Continue (not wired)",
		back: "← Home",
	},
	bg: {
		kicker: "AgriNexus · apps/web",
		title: "Вход (скелет)",
		body: "Временно място за OAuth или magic link по имейл. Свържи с",
		bodyTail: "когато authentication слоят е готов.",
		groupLabel: "Полета за вход (скелет)",
		email: "Имейл",
		placeholder: "ti@ferma.example",
		continue: "Продължи (още не е свързано)",
		back: "← Начало",
	},
};

export default async function LoginPage({ params }: PageProps) {
	const { locale } = await params;
	setRequestLocale(locale);
	const c = locale === "bg" ? copy.bg : copy.en;

	return (
		<main className="mx-auto max-w-md px-6 py-16">
			<p className="text-sm font-medium uppercase tracking-wide text-emerald-800">{c.kicker}</p>
			<h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{c.title}</h1>
			<p className="mt-2 text-sm text-slate-600">
				{c.body} <code className="rounded bg-slate-200 px-1">apps/backend</code> {c.bodyTail}
			</p>
			<div className="mt-8 space-y-4" role="group" aria-label={c.groupLabel}>
				<label className="block text-sm font-medium text-slate-700">
					{c.email}
					<input
						type="email"
						name="email"
						autoComplete="email"
						className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm outline-none focus:border-emerald-600"
						placeholder={c.placeholder}
					/>
				</label>
				<button type="button" className="w-full rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white opacity-60" disabled>
					{c.continue}
				</button>
			</div>
			<p className="mt-8 text-sm">
				<Link href="/" className="text-emerald-800 underline underline-offset-4">
					{c.back}
				</Link>
			</p>
		</main>
	);
}

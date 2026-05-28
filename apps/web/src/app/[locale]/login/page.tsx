import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import SocialLogin from "@/components/Auth/SocialLogin";

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
				{c.body}
			</p>
			<div className="mt-8 flex justify-center" role="group" aria-label={c.groupLabel}>
				<SocialLogin />
			</div>
			<p className="mt-8 text-sm">
				<Link href="/" className="text-emerald-800 underline underline-offset-4">
					{c.back}
				</Link>
			</p>
		</main>
	);
}

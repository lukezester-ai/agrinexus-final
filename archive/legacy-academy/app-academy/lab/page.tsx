import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AcademyLabSimulation } from "@/components/academy-lab-simulation";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { locale } = await params;
	return locale === "bg"
		? {
				title: "Лаборатория · Академия · AgriNexus",
				description: "Учебна симулация: почва, време, разходи, добив и нетен резултат.",
			}
		: {
				title: "Lab · Academy · AgriNexus",
				description: "Learning simulation: soil, weather, costs, yield, and net result.",
			};
}

const copy = {
	en: {
		kicker: "AgriNexus · Academy",
		title: "Lab: trial-and-error simulation",
		body:
			"Enter soil, weather, and cost indicators per hectare. The model estimates planting success, expected yield (t/ha), and whether the result is positive or negative at the selected price per tonne. Experiment with the sliders and see what moves the result most.",
		backAcademy: "← Back to academy",
		lecturer: "Lecturer (materials + AI)",
		home: "Home (Next)",
	},
	bg: {
		kicker: "AgriNexus · Академия",
		title: "Лаборатория: симулация „проба – грешка“",
		body:
			"Въведете показатели за почвата, времето и разходите по хектар. Моделът оценява колко успешно е засаждането, очакван добив (t/ha) и дали при зададена цена на тон сметката излиза на плюс или на минус. Експериментирайте с плъзгачите и вижте кое най-силно мести резултата.",
		backAcademy: "← Към академията",
		lecturer: "Лектор (материали + AI)",
		home: "Начало (Next)",
	},
};

export default async function AcademyLabPage({ params }: PageProps) {
	const { locale } = await params;
	setRequestLocale(locale);
	const c = locale === "bg" ? copy.bg : copy.en;

	return (
		<main className="mx-auto max-w-4xl px-6 py-16">
			<p className="text-sm font-medium uppercase tracking-wide text-emerald-800">{c.kicker}</p>
			<h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{c.title}</h1>
			<p className="mt-3 max-w-3xl text-slate-600">{c.body}</p>

			<AcademyLabSimulation />

			<p className="mt-10 flex flex-wrap gap-4 text-sm">
				<Link href="/academy" className="text-emerald-800 underline underline-offset-4">{c.backAcademy}</Link>
				<Link href="/academy/lecturer" className="text-emerald-800 underline underline-offset-4">{c.lecturer}</Link>
				<Link href="/" className="text-emerald-800 underline underline-offset-4">{c.home}</Link>
			</p>
		</main>
	);
}

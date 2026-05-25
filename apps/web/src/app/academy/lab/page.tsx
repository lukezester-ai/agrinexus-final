import Link from "next/link";
import { AcademyLabSimulation } from "@/components/academy-lab-simulation";

export const metadata = {
	title: "Лаборатория · Академия · AgriNexus",
	description: "Учебна симулация: почва, време, разходи, добив и нетен резултат.",
};

export default function AcademyLabPage() {
	return (
		<main className="mx-auto max-w-4xl px-6 py-16">
			<p className="text-sm font-medium uppercase tracking-wide text-emerald-800">AgriNexus · Академия</p>
			<h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Лаборатория: симулация „проба – грешка“</h1>
			<p className="mt-3 max-w-3xl text-slate-600">
				Въведете показатели за почвата, времето и разходите по хектар. Моделът оценява колко „успешно“ е засаждането,
				очакван добив (t/ha) и дали при зададена цена на тон сметката излиза на плюс или на минус. Експериментирайте с
				плъзгачите — вижте кое най-силно мести резултата.
			</p>

			<AcademyLabSimulation />

			<p className="mt-10 flex flex-wrap gap-4 text-sm">
				<Link href="/academy" className="text-emerald-800 underline underline-offset-4">
					← Към академията
				</Link>
				<Link href="/academy/lecturer" className="text-emerald-800 underline underline-offset-4">
					Лектор (материали + AI)
				</Link>
				<Link href="/" className="text-emerald-800 underline underline-offset-4">
					Начало (Next)
				</Link>
			</p>
		</main>
	);
}

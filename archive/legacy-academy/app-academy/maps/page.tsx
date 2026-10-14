import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AcademyMapsLabDynamic } from "@/components/academy-maps-lab-dynamic";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { locale } = await params;
	return locale === "bg"
		? {
				title: "Жива карта · Академия · AgriNexus",
				description: "Учебна карта: OSM, сателит, очертаване на блок и GeoJSON.",
			}
		: {
				title: "Live map lab · Academy · AgriNexus",
				description: "Training map: OSM, satellite, polygon sketch, GeoJSON export.",
			};
}

const copy = {
	en: {
		kicker: "AgriNexus · Academy",
		title: "Live map lab",
		body: "Use real map tiles in the browser. Switch between street basemap and satellite, click to place polygon vertices, then export GeoJSON for QGIS or your integrator. This is a teaching surface — not a cadastral record.",
		course: "Course: Maps and fields",
		backAcademy: "← Back to academy",
		labSoil: "Soil simulation lab",
		lecturer: "Lecturer",
		home: "Home",
	},
	bg: {
		kicker: "AgriNexus · Академия",
		title: "Лаборатория: жива карта",
		body: "Реални плочки в браузъра. Превключете улици и сателит, кликнете за върхове на полигон и изтеглете GeoJSON за QGIS или интегратор. Това е учебна повърхност — не кадастър.",
		course: "Курс: Карти и полета",
		backAcademy: "← Към академията",
		labSoil: "Лаборатория (симулация почва)",
		lecturer: "Лектор",
		home: "Начало",
	},
};

export default async function AcademyMapsPage({ params }: PageProps) {
	const { locale } = await params;
	setRequestLocale(locale);
	const loc = locale === "bg" ? "bg" : "en";
	const c = loc === "bg" ? copy.bg : copy.en;

	return (
		<main className="mx-auto min-w-0 max-w-4xl px-6 py-14 sm:py-16">
			<p className="text-sm font-medium uppercase tracking-wide text-forest-700">{c.kicker}</p>
			<h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{c.title}</h1>
			<p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-600">{c.body}</p>
			<p className="mt-2 text-sm text-forest-800">
				<Link href="/academy/course/maps-and-fields" className="font-medium underline underline-offset-4">
					{c.course}
				</Link>
			</p>

			<AcademyMapsLabDynamic locale={loc} />

			<p className="mt-10 flex flex-wrap gap-4 text-sm">
				<Link href="/academy" className="font-medium text-forest-800 underline underline-offset-4">
					{c.backAcademy}
				</Link>
				<Link href="/academy/lab" className="font-medium text-forest-800 underline underline-offset-4">
					{c.labSoil}
				</Link>
				<Link href="/academy/lecturer" className="font-medium text-forest-800 underline underline-offset-4">
					{c.lecturer}
				</Link>
				<Link href="/" className="font-medium text-forest-800 underline underline-offset-4">
					{c.home}
				</Link>
			</p>
		</main>
	);
}

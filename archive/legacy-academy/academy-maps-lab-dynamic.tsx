"use client";

import dynamic from "next/dynamic";

const AcademyMapsLab = dynamic(
	() => import("@/components/academy-maps-lab").then((m) => ({ default: m.AcademyMapsLab })),
	{
		ssr: false,
		loading: () => <div className="mt-8 h-[min(70vh,520px)] w-full animate-pulse rounded-2xl bg-slate-100" />,
	},
);

export function AcademyMapsLabDynamic({ locale }: { locale: "bg" | "en" }) {
	return <AcademyMapsLab locale={locale} />;
}

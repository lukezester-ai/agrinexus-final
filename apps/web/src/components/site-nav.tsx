"use client";

import { useParams } from "next/navigation";
import { Nav } from "@/components/Nav";
import { parseAppLocale } from "@/i18n/routing";

export function SiteNav() {
	const params = useParams();
	const locale = parseAppLocale(params?.locale);
	return <Nav locale={locale} />;
}

import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
	locales: ["en", "bg", "ar"],
	defaultLocale: "en",
	localePrefix: "as-needed",
	localeDetection: false,
});

export type AppLocale = (typeof routing.locales)[number];

export function parseAppLocale(value: unknown): AppLocale {
	if (typeof value === "string" && (routing.locales as readonly string[]).includes(value)) {
		return value as AppLocale;
	}
	return routing.defaultLocale;
}

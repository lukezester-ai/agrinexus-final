import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type AppLocale = "en" | "bg";

type Ctx = {
	locale: AppLocale;
	setLocale: (l: AppLocale) => void;
	toggleLocale: () => void;
};

const LanguageContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
	const [locale, setLocale] = useState<AppLocale>("bg");
	const toggleLocale = useCallback(() => {
		setLocale((prev) => (prev === "bg" ? "en" : "bg"));
	}, []);
	const value = useMemo(() => ({ locale, setLocale, toggleLocale }), [locale, toggleLocale]);
	return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
	const ctx = useContext(LanguageContext);
	if (!ctx) {
		throw new Error("useLanguage must be used within LanguageProvider");
	}
	return ctx;
}

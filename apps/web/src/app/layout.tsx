import "./globals.css";
import type { ReactNode } from "react";

/** Root pass-through — real `<html>` lives in `[locale]/layout.tsx` (next-intl). */
export default function RootLayout({ children }: { children: ReactNode }) {
	return children;
}

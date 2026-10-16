import createMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { routing } from "./src/i18n/routing";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase-config";

/**
 * Единствен middleware за приложението.
 *
 * Next.js изпълнява само един middleware — този до app директорията.
 * Затова i18n routing (next-intl) и Supabase session refresh са композирани тук,
 * вместо да живеят в два отделни файла, където единият бива игнориран.
 */

const handleI18nRouting = createMiddleware(routing);

/** Пътища, изискващи логин (проверяват се след премахване на locale префикса). */
const protectedPaths = ["/dashboard", "/fields", "/market", "/tutor", "/profile", "/onboarding"];

/** Маха locale префикса, за да се сравнява с locale-независимите пътища по-долу. */
function stripLocalePrefix(pathname: string): string {
	for (const locale of routing.locales) {
		if (pathname === `/${locale}`) return "/";
		if (pathname.startsWith(`/${locale}/`)) return pathname.slice(locale.length + 1);
	}
	return pathname;
}

export async function middleware(request: NextRequest) {
	// 1) next-intl решава locale rewrite/redirect и връща response.
	const response = handleI18nRouting(request);

	// 2) Supabase session refresh върху същия response (cookies се пишат и в двата).
	const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
		cookies: {
			getAll() {
				return request.cookies.getAll();
			},
			setAll(cookiesToSet) {
				cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
				cookiesToSet.forEach(({ name, value, options }) =>
					response.cookies.set(name, value, options)
				);
			},
		},
	});

	const {
		data: { user },
	} = await supabase.auth.getUser();

	const pathname = stripLocalePrefix(request.nextUrl.pathname);

	const isProtectedPath = protectedPaths.some(
		(path) => pathname === path || pathname.startsWith(`${path}/`)
	);

	// Ако потребителят НЕ е логнат и се опитва да влезе в защитен път
	if (!user && isProtectedPath) {
		const redirectUrl = new URL("/login", request.url);
		redirectUrl.searchParams.set("redirectedFrom", request.nextUrl.pathname);
		return NextResponse.redirect(redirectUrl);
	}

	// Ако потребителят Е логнат и се опитва да влезе в login страницата
	if (user && pathname === "/login") {
		return NextResponse.redirect(new URL("/dashboard", request.url));
	}

	return response;
}

// Конфигурация – на кои пътища да се прилага middleware
export const config = {
	matcher: ["/((?!api|_next|_vercel|dev|.*\\..*).*)"],
};

import { createServerClient } from "@supabase/ssr";
import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase-config";

/**
 * Единственият middleware на приложението.
 *
 * Next.js зачита САМО ЕДИН middleware и го търси нерекурсивно в родителя на app
 * директорията (`apps/web/`). Затова next-intl routing и Supabase session refresh
 * трябва да са композирани тук — файл в `src/` се игнорира напълно.
 */

const handleI18nRouting = createMiddleware(routing);

/** Пътища, достъпни без логин. */
const PUBLIC_PATHS = ["/", "/login", "/auth/callback", "/academy", "/about"];

/** Пътища, изискващи логин (проверяват се след махане на locale префикса). */
const PROTECTED_PATHS = ["/dashboard", "/fields", "/market", "/tutor", "/profile", "/onboarding"];

/** `/bg/dashboard` → `/dashboard`; `/en/dashboard` → `/dashboard` (localePrefix: "as-needed"). */
function stripLocalePrefix(pathname: string): string {
	for (const locale of routing.locales) {
		if (pathname === `/${locale}`) return "/";
		if (pathname.startsWith(`/${locale}/`)) return pathname.slice(locale.length + 1);
	}
	return pathname;
}

/** Locale префиксът на текущия път, за да сочат redirect-ите към правилния език. */
function localePrefixOf(pathname: string): string {
	for (const locale of routing.locales) {
		if (locale === routing.defaultLocale) continue;
		if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) return `/${locale}`;
	}
	return "";
}

export async function middleware(request: NextRequest) {
	// 1) next-intl първо: нормализира locale префикса и при нужда връща redirect
	//    (или rewrite за "as-needed" префикса, който трябва да се запази).
	const response = handleI18nRouting(request);
	if (response.status >= 300 && response.status < 400) return response;

	// 2) Supabase session refresh върху вече изчисления отговор.
	let supabaseResponse = response;

	const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
		cookies: {
			getAll() {
				return request.cookies.getAll();
			},
			setAll(cookiesToSet) {
				cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
				cookiesToSet.forEach(({ name, value, options }) =>
					supabaseResponse.cookies.set(name, value, options)
				);
			},
		},
	});

	const {
		data: { user },
	} = await supabase.auth.getUser();

	const { pathname, search } = request.nextUrl;
	const barePathname = stripLocalePrefix(pathname);
	const localePrefix = localePrefixOf(pathname);

	const isPublicPath = PUBLIC_PATHS.some(
		(path) => barePathname === path || barePathname.startsWith(`${path}/`),
	);
	const isProtectedPath = PROTECTED_PATHS.some(
		(path) => barePathname === path || barePathname.startsWith(`${path}/`),
	);

	// Не е логнат и иска защитен път → към login страницата на същия език.
	if (!user && isProtectedPath && !isPublicPath) {
		const redirectUrl = new URL(`${localePrefix}/login`, request.url);
		redirectUrl.searchParams.set("redirectedFrom", `${pathname}${search}`);
		return NextResponse.redirect(redirectUrl);
	}

	// Логнат и отваря login → към dashboard.
	if (user && barePathname === "/login") {
		return NextResponse.redirect(new URL(`${localePrefix}/dashboard`, request.url));
	}

	return supabaseResponse;
}

export const config = {
	// Изключва API маршрути, Next internals и файлове с разширение — за да минава
	// и локализацията, и Supabase session refresh на всички page routes.
	matcher: ["/((?!api|_next|_vercel|dev|.*\\..*).*)"],
};

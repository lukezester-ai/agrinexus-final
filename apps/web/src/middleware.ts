import createIntlMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase-config";

const intlMiddleware = createIntlMiddleware(routing);

function localePrefix(pathname: string): "" | "/bg" | "/ar" {
	if (pathname === "/bg" || pathname.startsWith("/bg/")) return "/bg";
	if (pathname === "/ar" || pathname.startsWith("/ar/")) return "/ar";
	return "";
}

function pathWithoutLocale(pathname: string): string {
	const rest = pathname.replace(/^\/(en|bg|ar)(?=\/|$)/, "");
	return rest === "" ? "/" : rest;
}

function copyCookies(from: NextResponse, to: NextResponse): NextResponse {
	from.cookies.getAll().forEach((cookie) => {
		to.cookies.set(cookie.name, cookie.value);
	});
	return to;
}

export async function middleware(request: NextRequest) {
	const intlResponse = intlMiddleware(request);

	const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
		cookies: {
			getAll() {
				return request.cookies.getAll();
			},
			setAll(cookiesToSet) {
				cookiesToSet.forEach(({ name, value, options }) => {
					request.cookies.set(name, value);
					intlResponse.cookies.set(name, value, options);
				});
			},
		},
	});

	const {
		data: { user },
	} = await supabase.auth.getUser();

	const pathname = request.nextUrl.pathname;
	const path = pathWithoutLocale(pathname);
	const prefix = localePrefix(pathname);

	const isCallback = path === "/auth/callback" || path.startsWith("/auth/callback");
	const isLogin = path === "/login";
	const isProtected = path === "/dashboard" || path.startsWith("/dashboard");

	if (!user && isProtected) {
		const url = request.nextUrl.clone();
		url.pathname = `${prefix}/login`;
		return copyCookies(intlResponse, NextResponse.redirect(url));
	}

	if (user && isLogin && !isCallback) {
		const url = request.nextUrl.clone();
		url.pathname = `${prefix}/dashboard`;
		return copyCookies(intlResponse, NextResponse.redirect(url));
	}

	return intlResponse;
}

export const config = {
	matcher: ["/((?!api|_next|_vercel|dev|.*\\..*).*)"],
};

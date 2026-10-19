import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { parseAppLocale } from "@/i18n/routing";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase-config";

export async function GET(
	request: NextRequest,
	context: { params: Promise<{ locale: string }> },
) {
	const { locale: rawLocale } = await context.params;
	const locale = parseAppLocale(rawLocale);
	const url = new URL(request.url);
	const code = url.searchParams.get("code");
	const prefix = locale === "en" ? "" : `/${locale}`;
	const origin = url.origin;

	if (!code) {
		return NextResponse.redirect(new URL(`${prefix}/login`, origin));
	}

	const redirectTo = NextResponse.redirect(new URL(`${prefix}/dashboard`, origin));
	const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
		cookies: {
			getAll() {
				return request.cookies.getAll();
			},
			setAll(cookiesToSet) {
				cookiesToSet.forEach(({ name, value, options }) => {
					redirectTo.cookies.set(name, value, options);
				});
			},
		},
	});

	const { error } = await supabase.auth.exchangeCodeForSession(code);
	if (error) {
		return NextResponse.redirect(new URL(`${prefix}/login`, origin));
	}

	return redirectTo;
}

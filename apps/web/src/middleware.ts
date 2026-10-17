import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

/**
 * The Skill Squad landing page is a standalone static document served from
 * `public/landing` (see the `/` rewrite in next.config.ts). Locale negotiation
 * must not touch it, otherwise next-intl redirects `/` to `/en`.
 */
export default function middleware(request: NextRequest) {
	if (request.nextUrl.pathname === "/") {
		return NextResponse.next();
	}
	return intlMiddleware(request);
}

export const config = {
	matcher: ["/((?!api|_next|_vercel|dev|.*\\..*).*)"],
};

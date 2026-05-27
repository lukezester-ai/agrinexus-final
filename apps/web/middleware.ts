import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const pathname = req.nextUrl.pathname;

  // Публични пътища (достъпни без логин)
  const publicPaths = ['/', '/login', '/auth/callback', '/academy', '/about'];
  
  // Пътища, които изискват логин
  const protectedPaths = ['/dashboard', '/fields', '/market', '/tutor', '/profile', '/onboarding'];

  const isPublicPath = publicPaths.some(path => pathname === path || pathname.startsWith(path));
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));

  // Ако потребителят НЕ е логнат и се опитва да влезе в защитен път
  if (!session && isProtectedPath) {
    const redirectUrl = new URL('/login', req.url);
    redirectUrl.searchParams.set('redirectedFrom', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Ако потребителят Е логнат и се опитва да влезе в login страницата
  if (session && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return res;
}

// Конфигурация – на кои пътища да се прилага middleware
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/fields/:path*',
    '/market/:path*',
    '/tutor/:path*',
    '/profile/:path*',
    '/login',
    '/auth/callback',
  ],
};

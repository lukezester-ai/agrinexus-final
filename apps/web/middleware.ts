import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/supabase-config';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Публични пътища (достъпни без логин)
  const publicPaths = ['/', '/login', '/auth/callback', '/academy', '/about'];
  
  // Пътища, които изискват логин
  const protectedPaths = ['/dashboard', '/fields', '/market', '/tutor', '/profile', '/onboarding'];

  const isPublicPath = publicPaths.some(path => pathname === path || pathname.startsWith(path));
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));

  // Ако потребителят НЕ е логнат и се опитва да влезе в защитен път
  if (!user && isProtectedPath) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirectedFrom', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Ако потребителят Е логнат и се опитва да влезе в login страницата
  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return supabaseResponse;
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

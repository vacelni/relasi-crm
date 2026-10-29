import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { publicSupabaseEnv } from '@/lib/env';

/**
 * Refreshes the Supabase session cookie on every request and sends signed-out visitors of the
 * app to /login. This is only the optimistic check: pages still load the user and their
 * membership, and RLS decides what any query returns.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = publicSupabaseEnv();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  // Do not run code between createServerClient and getClaims: it refreshes the session.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const path = request.nextUrl.pathname;

  if (!signedIn && (path.startsWith('/o') || path.startsWith('/onboarding'))) {
    const login = request.nextUrl.clone();
    login.pathname = '/login';
    login.search = `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(login);
  }
  if (signedIn && (path === '/login' || path === '/signup')) {
    const app = request.nextUrl.clone();
    app.pathname = '/o';
    app.search = '';
    return NextResponse.redirect(app);
  }
  return response;
}

export const config = {
  // Everything except static files, images, and the payment webhook (no session there).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|api/billing/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};

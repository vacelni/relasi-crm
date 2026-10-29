import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { safeRedirectPath } from '@/lib/redirect';
import { createClient } from '@/lib/supabase/server';

/** Email confirmation links land here: a PKCE code, or a token hash from a custom email template. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeRedirectPath(searchParams.get('next'), '/onboarding');
  const supabase = await createClient();

  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error('missing code') };

  const origin = request.nextUrl.origin;
  if (error) return NextResponse.redirect(new URL('/login?confirm=failed', origin));
  // Defense in depth: whatever `next` was, the redirect stays on this host.
  const target = new URL(next, origin);
  return NextResponse.redirect(target.origin === origin ? target : new URL('/onboarding', origin));
}

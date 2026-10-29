import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/** Email confirmation links land here: a PKCE code, or a token hash from a custom email template. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const nextParam = searchParams.get('next') ?? '/onboarding';
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/onboarding';
  const supabase = await createClient();

  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error('missing code') };

  const target = request.nextUrl.clone();
  target.search = '';
  if (error) {
    target.pathname = '/login';
    target.searchParams.set('confirm', 'failed');
  } else {
    target.pathname = next;
  }
  return NextResponse.redirect(target);
}

/**
 * Guards for the Supabase key that is bundled into the browser. Only the publishable key may
 * ever reach the client: a secret or service_role key bypasses RLS. next.config.ts runs this at
 * dev/build time so a misconfigured key fails the build instead of being shipped.
 */
export function assertPublishableKey(key: string): void {
  if (key.startsWith('sb_secret_')) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY contains a secret key (sb_secret_…). ' +
        'Use the publishable key (sb_publishable_…); secret keys belong only in server-side env vars (SUPABASE_SECRET_KEY).',
    );
  }

  const role = legacyJwtRole(key);
  if (role !== null && role !== 'anon') {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is a legacy JWT key with role "${role}". ` +
        'Only the publishable (or legacy anon) key may be used in the browser.',
    );
  }
}

/** Role claim of a legacy JWT API key, or null when the key is not a decodable JWT. */
function legacyJwtRole(key: string): string | null {
  const payload = key.split('.')[1];
  if (key.split('.').length !== 3 || payload === undefined) return null;

  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  let claims: unknown;
  try {
    claims = JSON.parse(atob(padded));
  } catch {
    // Not a JWT (e.g. an sb_publishable_ key containing dots); nothing to inspect.
    return null;
  }

  if (typeof claims === 'object' && claims !== null && 'role' in claims && typeof claims.role === 'string') {
    return claims.role;
  }
  return null;
}

/** The public Supabase settings, read where Next.js inlines them. Throws when missing. */
export function publicSupabaseEnv(): { url: string; publishableKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set (see .env.example).');
  }
  return { url, publishableKey };
}

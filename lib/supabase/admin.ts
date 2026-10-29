import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { publicSupabaseEnv } from '@/lib/env';

/**
 * Service-role client. It bypasses RLS, so it is used in exactly one place: the payment
 * webhook, which has no user session and only calls apply_billing_notification().
 */
export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) throw new Error('SUPABASE_SECRET_KEY is not set.');
  return createClient<Database>(publicSupabaseEnv().url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

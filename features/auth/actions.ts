'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { FormState } from '@/components/forms';
import { safeRedirectPath as safeNext } from '@/lib/redirect';
import { siteOrigin } from '@/lib/site';
import { createClient } from '@/lib/supabase/server';
import { fieldErrors } from '@/lib/validation';

const signInSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email.')),
  password: z.string().min(1, 'Enter your password.'),
});

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse({ email: formData.get('email'), password: formData.get('password') });
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { error: error.code === 'email_not_confirmed' ? 'Confirm your email first (check your inbox).' : 'Wrong email or password.' };
  }
  redirect(safeNext(formData.get('next'), '/o'));
}

const DEMO_ACCOUNTS = {
  owner: 'owner@demo.relasi.test',
  sales: 'sales@demo.relasi.test',
} as const;

/** Signs in to the shared demo workspace (the accounts are public; reset hourly). */
export async function signInDemo(formData: FormData): Promise<void> {
  if (process.env.NEXT_PUBLIC_DEMO_ENABLED !== 'true') redirect('/login');
  const role = formData.get('role') === 'sales' ? 'sales' : 'owner';
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: DEMO_ACCOUNTS[role], password: 'relasi-demo' });
  if (error) redirect('/login?demo=unavailable');
  redirect('/o/de000000-0000-4000-8000-000000000001');
}

const signUpSchema = z.object({
  full_name: z.string().trim().min(1, 'Enter your name.').max(80),
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email.')),
  password: z.string().min(8, 'Use at least 8 characters.').max(72),
});

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signUpSchema.safeParse({
    full_name: formData.get('full_name'),
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };

  const next = safeNext(formData.get('next'), '/onboarding');
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.full_name },
      emailRedirectTo: `${await siteOrigin()}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) {
    if (error.code === 'weak_password') return { fields: { password: 'Choose a stronger password.' } };
    if (error.code === 'over_email_send_rate_limit') return { error: 'Too many sign-ups right now. Try again in a few minutes.' };
    return { error: 'Could not create the account. Try again.' };
  }
  // With email confirmation off (local development) the user is signed in already.
  if (data.session) redirect(next);
  return { ok: true, message: 'Check your inbox for a confirmation link.' };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

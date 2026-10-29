import 'server-only';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { isUuid } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';

export type Role = 'owner' | 'admin' | 'sales';

export type OrgContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: { id: string; email: string; fullName: string | null };
  org: { id: string; name: string; plan: 'free' | 'pro'; planExpiresAt: string | null; isDemo: boolean };
  role: Role;
};

/** The signed-in user (verified with the auth server), or a redirect to /login. Once per request. */
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', data.user.id).maybeSingle();
  return {
    supabase,
    user: { id: data.user.id, email: data.user.email ?? '', fullName: profile?.full_name ?? null },
  };
});

/**
 * The organization in the URL and the caller's role in it. A non-member gets the same 404 as a
 * missing organization, so workspace ids cannot be probed. This gates the UI; RLS still decides
 * what every query returns.
 */
export const requireOrg = cache(async (orgId: string): Promise<OrgContext> => {
  if (!isUuid(orgId)) notFound();
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from('memberships')
    .select('role, organizations (id, name, plan, plan_expires_at, is_demo)')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!data?.organizations) notFound();
  const org = data.organizations;
  return {
    supabase,
    user,
    role: data.role as Role,
    org: {
      id: org.id,
      name: org.name,
      plan: org.plan as 'free' | 'pro',
      planExpiresAt: org.plan_expires_at,
      isDemo: org.is_demo,
    },
  };
});

export function isAdmin(role: Role): boolean {
  return role === 'owner' || role === 'admin';
}

/** Pro, unless it lapsed (the database applies the same rule to limits). */
export function effectivePlan(org: OrgContext['org']): 'free' | 'pro' {
  return org.plan === 'pro' && (!org.planExpiresAt || new Date(org.planExpiresAt) > new Date()) ? 'pro' : 'free';
}

/** Whether a role may edit a record owned by ownerId (mirrors the update policies). */
export function canEdit(ctx: Pick<OrgContext, 'role' | 'user'>, ownerId: string | null): boolean {
  return isAdmin(ctx.role) || ownerId === ctx.user.id;
}

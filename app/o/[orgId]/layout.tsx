import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { Badge } from '@/components/ui';
import { signOut } from '@/features/auth/actions';
import { effectivePlan, requireOrg } from '@/lib/org';
import { NavLinks } from './NavLinks';
import { OrgSwitcher } from './OrgSwitcher';

export default async function WorkspaceLayout({ children, params }: { children: React.ReactNode; params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const ctx = await requireOrg(orgId);
  const { data: memberships } = await ctx.supabase
    .from('memberships')
    .select('org_id, organizations (name)')
    .eq('user_id', ctx.user.id)
    .order('created_at');
  const workspaces = (memberships ?? []).map((m) => ({ id: m.org_id, name: m.organizations?.name ?? 'Workspace' }));

  return (
    <div className="min-h-dvh lg:flex">
      <aside className="border-b border-border bg-surface lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-60 lg:shrink-0 lg:flex-col lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between gap-2 px-4 py-3 lg:block lg:space-y-3 lg:py-4">
          <Link href={`/o/${orgId}`} aria-label="Dashboard">
            <Logo />
          </Link>
          <OrgSwitcher current={orgId} workspaces={workspaces} />
        </div>
        <NavLinks orgId={orgId} />
        <div className="hidden border-t border-border px-4 py-3 text-xs lg:mt-auto lg:block">
          <p className="truncate font-medium text-foreground">{ctx.user.fullName ?? ctx.user.email}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-muted">
            <span className="capitalize">{ctx.role}</span>
            <span aria-hidden="true">·</span>
            <Badge tone={effectivePlan(ctx.org) === 'pro' ? 'success' : 'neutral'}>{effectivePlan(ctx.org) === 'pro' ? 'Pro' : 'Free'}</Badge>
          </p>
          <form action={signOut} className="mt-2">
            <button className="text-muted hover:text-foreground hover:underline">Sign out</button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {ctx.org.isDemo ? (
          <div className="border-b border-warning/20 bg-warning-soft px-4 py-2 text-center text-xs text-warning-ink">
            Demo workspace: you are signed in as <strong>{ctx.user.fullName}</strong> ({ctx.role}). Changes are visible to other
            visitors and reset every hour.{' '}
            <form action={signOut} className="inline">
              <button className="font-medium underline">Leave demo</button>
            </form>
          </div>
        ) : null}
        <main className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

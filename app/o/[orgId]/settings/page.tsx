import type { Metadata } from 'next';
import { Alert, Badge, Card, CardHeader, PageHeader } from '@/components/ui';
import { removeMember, revokeInvitation, setMemberRole } from '@/features/orgs/actions';
import { formatDate, isoHoursAgo } from '@/lib/format';
import { effectivePlan, isAdmin, requireOrg } from '@/lib/org';
import { siteOrigin } from '@/lib/site';
import { CopyLink } from './CopyLink';
import { InviteForm, RenameForm } from './SettingsForms';
import { SettingsNav } from './SettingsNav';

export const metadata: Metadata = { title: 'Settings' };

const PLAN_LIMITS = { free: { seats: 3, ai: 30 }, pro: { seats: 25, ai: 500 } };

export default async function SettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { orgId } = await params;
  const { error } = await searchParams;
  const ctx = await requireOrg(orgId);
  const { supabase, role, user, org } = ctx;
  const admin = isAdmin(role);
  const plan = effectivePlan(org);
  const limits = org.isDemo ? { ...PLAN_LIMITS.free, ai: 60 } : PLAN_LIMITS[plan];
  const dayAgo = isoHoursAgo(24);

  const [members, invitations, aiUsage, origin] = await Promise.all([
    supabase.from('memberships').select('user_id, role, created_at, profiles (full_name, email)').eq('org_id', orgId).order('created_at'),
    admin
      ? supabase.from('invitations').select('id, email, role, token, expires_at').eq('org_id', orgId).is('accepted_at', null).order('created_at')
      : Promise.resolve({ data: [] as { id: string; email: string; role: string; token: string; expires_at: string }[] }),
    supabase.from('ai_usage').select('id', { count: 'exact', head: true }).eq('org_id', orgId).gte('created_at', dayAgo),
    siteOrigin(),
  ]);
  const openInvites = (invitations.data ?? []).filter((i) => new Date(i.expires_at) > new Date());
  const seatsUsed = (members.data?.length ?? 0) + openInvites.length;

  return (
    <>
      <PageHeader title="Settings" />
      <SettingsNav orgId={orgId} current="general" isOwner={role === 'owner'} isAdmin={admin} />
      {error ? (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Members" description={`${seatsUsed} of ${limits.seats} seats used (including open invitations)`} />
            <ul className="divide-y divide-border">
              {(members.data ?? []).map((m) => {
                const self = m.user_id === user.id;
                const canRemove = !self && m.role !== 'owner' && (role === 'owner' || (role === 'admin' && m.role === 'sales'));
                return (
                  <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {m.profiles?.full_name ?? m.profiles?.email} {self ? <span className="text-muted">(you)</span> : null}
                      </p>
                      <p className="text-xs text-muted">
                        {m.profiles?.email} · joined {formatDate(m.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {role === 'owner' && m.role !== 'owner' && !org.isDemo ? (
                        <form action={setMemberRole.bind(null, orgId)} className="flex items-center gap-1">
                          <input type="hidden" name="user_id" value={m.user_id} />
                          <select name="role" defaultValue={m.role} aria-label={`Role of ${m.profiles?.full_name ?? 'member'}`} className="rounded-control border border-border-strong bg-surface px-2 py-1 text-sm">
                            <option value="admin">Admin</option>
                            <option value="sales">Sales</option>
                          </select>
                          <button className="text-xs font-medium text-primary hover:underline">Save</button>
                        </form>
                      ) : (
                        <Badge tone={m.role === 'owner' ? 'primary' : 'neutral'}>{m.role}</Badge>
                      )}
                      {canRemove && !org.isDemo ? (
                        <form action={removeMember.bind(null, orgId)}>
                          <input type="hidden" name="user_id" value={m.user_id} />
                          <button className="text-xs text-muted hover:text-danger">Remove</button>
                        </form>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
            {role !== 'owner' && !org.isDemo ? (
              <form action={removeMember.bind(null, orgId)} className="border-t border-border px-4 py-3">
                <input type="hidden" name="user_id" value={user.id} />
                <button className="text-xs text-danger hover:underline">Leave this workspace</button>
              </form>
            ) : null}
          </Card>

          {admin ? (
            <Card>
              <CardHeader
                title="Invite a teammate"
                description="Relasi does not send emails: share the link yourself (WhatsApp works). It expires in 7 days and only works for the email you enter."
              />
              <div className="p-4">
                {org.isDemo ? <Alert tone="warning">Invitations are disabled in the demo workspace.</Alert> : <InviteForm orgId={orgId} />}
              </div>
              {openInvites.length ? (
                <ul className="divide-y divide-border border-t border-border">
                  {openInvites.map((invite) => (
                    <li key={invite.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {invite.email} <Badge>{invite.role}</Badge>
                        </p>
                        <p className="text-xs text-muted">Expires {formatDate(invite.expires_at)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <CopyLink url={`${origin}/invite/${invite.token}`} />
                        <form action={revokeInvitation.bind(null, orgId)}>
                          <input type="hidden" name="id" value={invite.id} />
                          <button className="text-xs text-muted hover:text-danger">Revoke</button>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Workspace" />
            <div className="p-4">
              {admin ? <RenameForm orgId={orgId} name={org.name} /> : <p className="text-sm">{org.name}</p>}
            </div>
          </Card>
          <Card>
            <CardHeader title="AI usage" description="Rolling 24 hours, shared by the workspace" />
            <div className="p-4">
              <p className="text-2xl font-semibold tabular-nums">
                {aiUsage.count ?? 0} <span className="text-sm font-normal text-muted">/ {limits.ai} calls</span>
              </p>
              <div className="mt-2 h-2 rounded-full bg-subtle">
                <div className="h-2 rounded-full bg-ai" style={{ width: `${Math.min(100, ((aiUsage.count ?? 0) / limits.ai) * 100)}%` }} />
              </div>
              <p className="mt-2 text-xs text-muted">Each member can also make at most 8 calls a minute.</p>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

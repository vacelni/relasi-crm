import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, Card, CardHeader, EmptyState, PageHeader } from '@/components/ui';
import { formatDateTime, formatRelativeDays, formatRupiah, formatRupiahShort } from '@/lib/format';
import { requireOrg } from '@/lib/org';

export const metadata: Metadata = { title: 'Dashboard' };

type Metrics = {
  win_rate: number | null;
  won_value_90d: number;
  won_count_90d: number;
  lost_count_90d: number;
  open_value: number;
  weighted_value: number;
  contacts: number;
  overdue_tasks: number;
  stages: { id: string; name: string; kind: 'open' | 'won' | 'lost'; probability: number; count: number; value: number }[];
};

export default async function DashboardPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const { supabase, user, org } = await requireOrg(orgId);
  const base = `/o/${orgId}`;

  const [metricsResult, tasks, hotLeads, recent] = await Promise.all([
    supabase.rpc('org_metrics', { p_org: orgId }),
    supabase
      .from('activities')
      .select('id, subject, due_at, contacts (id, full_name)')
      .eq('org_id', orgId)
      .eq('owner_id', user.id)
      .is('completed_at', null)
      .not('due_at', 'is', null)
      .order('due_at')
      .limit(6),
    supabase
      .from('contacts')
      .select('id, full_name, ai_score, companies (name)')
      .eq('org_id', orgId)
      .not('ai_score', 'is', null)
      .order('ai_score', { ascending: false })
      .limit(5),
    supabase
      .from('activities')
      .select('id, kind, subject, created_at, contacts (id, full_name), profiles (full_name)')
      .eq('org_id', orgId)
      .not('completed_at', 'is', null)
      .order('created_at', { ascending: false })
      .limit(6),
  ]);
  const m = metricsResult.data as Metrics | null;
  const maxStage = Math.max(1, ...(m?.stages ?? []).map((s) => s.value));

  const tiles = [
    { label: 'Open pipeline', value: formatRupiah(m?.open_value ?? 0), note: 'All deals in open stages' },
    { label: 'Weighted pipeline', value: formatRupiah(m?.weighted_value ?? 0), note: 'Value × stage probability' },
    { label: 'Won, last 90 days', value: formatRupiah(m?.won_value_90d ?? 0), note: `${m?.won_count_90d ?? 0} deals` },
    {
      label: 'Win rate, last 90 days',
      value: m?.win_rate == null ? '—' : `${Math.round(m.win_rate * 100)}%`,
      note: `${m?.won_count_90d ?? 0} won · ${m?.lost_count_90d ?? 0} lost`,
    },
  ];

  return (
    <>
      <PageHeader title={org.name} description={`${m?.contacts ?? 0} contacts${m?.overdue_tasks ? ` · ${m.overdue_tasks} overdue tasks` : ''}`} />

      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Card key={tile.label} className="p-4">
            <p className="text-xs font-medium text-muted">{tile.label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight sm:text-2xl">{tile.value}</p>
            <p className="mt-1 text-xs text-muted">{tile.note}</p>
          </Card>
        ))}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader
            title="Pipeline value by stage"
            action={
              <Link href={`${base}/pipeline`} className="text-xs font-medium text-primary hover:underline">
                Open board
              </Link>
            }
          />
          {/* A bar list: every value is also written out, so it doubles as the table view. */}
          <ul className="space-y-3 px-4 py-4">
            {(m?.stages ?? []).map((stage) => (
              <li key={stage.id} title={`${stage.name}: ${formatRupiah(stage.value)} across ${stage.count} deals`}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">
                    {stage.name}{' '}
                    <span className="font-normal text-muted">
                      {stage.kind === 'open' ? `${stage.probability}% · ` : ''}
                      {stage.count} {stage.count === 1 ? 'deal' : 'deals'}
                    </span>
                  </span>
                  <span className="tabular-nums">{formatRupiahShort(stage.value)}</span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-subtle">
                  <div
                    className={stage.kind === 'lost' ? 'h-2 rounded-full bg-primary/35' : 'h-2 rounded-full bg-primary'}
                    style={{ width: `${(stage.value / maxStage) * 100}%`, minWidth: stage.value > 0 ? '4px' : 0 }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="My tasks"
            action={
              <Link href={`${base}/tasks`} className="text-xs font-medium text-primary hover:underline">
                All tasks
              </Link>
            }
          />
          {tasks.data?.length ? (
            <ul className="divide-y divide-border">
              {tasks.data.map((task) => {
                const overdue = new Date(task.due_at!) < new Date();
                return (
                  <li key={task.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{task.subject}</p>
                      {task.contacts ? (
                        <Link href={`${base}/contacts/${task.contacts.id}`} className="text-xs text-muted hover:underline">
                          {task.contacts.full_name}
                        </Link>
                      ) : null}
                    </div>
                    <Badge tone={overdue ? 'danger' : 'neutral'}>{overdue ? `Overdue · ${formatRelativeDays(task.due_at!)}` : formatRelativeDays(task.due_at!)}</Badge>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState title="No open tasks">Add a task from a contact page.</EmptyState>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Hottest leads" description="By AI lead score" />
          {hotLeads.data?.length ? (
            <ul className="divide-y divide-border">
              {hotLeads.data.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <Link href={`${base}/contacts/${c.id}`} className="min-w-0 hover:underline">
                    <span className="block truncate font-medium">{c.full_name}</span>
                    <span className="block truncate text-xs text-muted">{c.companies?.name ?? 'No company'}</span>
                  </Link>
                  <Badge tone={c.ai_score! >= 70 ? 'success' : c.ai_score! >= 40 ? 'warning' : 'neutral'}>{c.ai_score}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No scored leads yet">Open a contact and press “Score lead”.</EmptyState>
          )}
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader title="Recent activity" />
          {recent.data?.length ? (
            <ul className="divide-y divide-border">
              {recent.data.map((a) => (
                <li key={a.id} className="px-4 py-3 text-sm">
                  <p>
                    <span className="font-medium">{a.profiles?.full_name ?? 'Someone'}</span>{' '}
                    <span className="text-muted">logged a {a.kind}</span>
                    {a.contacts ? (
                      <>
                        {' '}
                        <span className="text-muted">with</span>{' '}
                        <Link href={`${base}/contacts/${a.contacts.id}`} className="font-medium hover:underline">
                          {a.contacts.full_name}
                        </Link>
                      </>
                    ) : null}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {a.subject} · {formatDateTime(a.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nothing logged yet" />
          )}
        </Card>
      </div>
    </>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, Card, CardHeader, EmptyState, PageHeader } from '@/components/ui';
import { activityVerb, formatDateTime, formatRelativeDays, formatRupiah, formatRupiahShort } from '@/lib/format';
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
  const openStages = (m?.stages ?? []).filter((s) => s.kind === 'open');
  const closedStages = (m?.stages ?? []).filter((s) => s.kind !== 'open');
  const maxOpen = Math.max(1, ...openStages.map((s) => s.value));

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
          {/* A bar list: every value is also written out, so it doubles as the table view. Open stages share one
              scale; closed deals are a separate outcome row, so a large Lost total does not flatten the funnel. */}
          <ul className="space-y-3 px-4 pt-4">
            {openStages.map((stage) => (
              <li key={stage.id} title={`${stage.name}: ${formatRupiah(stage.value)} across ${stage.count} deals`}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">
                    {stage.name}{' '}
                    <span className="font-normal text-muted">
                      {stage.probability}% · {stage.count} {stage.count === 1 ? 'deal' : 'deals'}
                    </span>
                  </span>
                  <span className="tabular-nums">{formatRupiahShort(stage.value)}</span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-subtle">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${(stage.value / maxOpen) * 100}%`, minWidth: stage.value > 0 ? '4px' : 0 }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <dl className="mx-4 mt-4 mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-control border border-border bg-border text-sm">
            {closedStages.map((stage) => (
              <div key={stage.id} className="bg-surface px-3 py-2">
                <dt className="flex items-center gap-1.5 text-xs text-muted">
                  <span aria-hidden="true" className={stage.kind === 'won' ? 'size-2 rounded-full bg-success' : 'size-2 rounded-full bg-danger/60'} />
                  {stage.name} · {stage.count} {stage.count === 1 ? 'deal' : 'deals'}
                </dt>
                <dd className={stage.kind === 'won' ? 'mt-0.5 font-semibold tabular-nums text-success-ink' : 'mt-0.5 font-semibold tabular-nums text-muted'}>
                  {formatRupiahShort(stage.value)}
                </dd>
              </div>
            ))}
          </dl>
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
                  <ScoreMeter score={c.ai_score!} />
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
                    <span className="text-muted">{activityVerb(a.kind).verb}</span>
                    {a.contacts ? (
                      <>
                        {' '}
                        {activityVerb(a.kind).withContact ? <span className="text-muted">{activityVerb(a.kind).withContact} </span> : null}
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

/** Lead score as a number plus a short bar, so the list can be scanned by length as well as by value. */
function ScoreMeter({ score }: { score: number }) {
  const tone = score >= 70 ? 'bg-success' : score >= 40 ? 'bg-warning' : 'bg-border-strong';
  return (
    <span className="flex shrink-0 items-center gap-2" aria-label={`Lead score ${score} out of 100`}>
      <span aria-hidden="true" className="h-1.5 w-16 rounded-full bg-subtle">
        <span className={`block h-1.5 rounded-full ${tone}`} style={{ width: `${score}%` }} />
      </span>
      <span className="w-7 text-right text-sm font-semibold tabular-nums">{score}</span>
    </span>
  );
}

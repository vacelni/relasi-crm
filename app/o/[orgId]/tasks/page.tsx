import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardHeader, EmptyState, PageHeader } from '@/components/ui';
import { toggleTask } from '@/features/activities/actions';
import { formatDateTime, formatRelativeDays } from '@/lib/format';
import { canEdit, requireOrg } from '@/lib/org';

export const metadata: Metadata = { title: 'Tasks' };

/** Reminders: open tasks grouped by due date, the user's own by default. */
export default async function TasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { orgId } = await params;
  const { scope = 'mine' } = await searchParams;
  const ctx = await requireOrg(orgId);

  let query = ctx.supabase
    .from('activities')
    .select('id, subject, due_at, owner_id, contacts (id, full_name), profiles (full_name)')
    .eq('org_id', orgId)
    .eq('kind', 'task')
    .is('completed_at', null)
    .order('due_at', { ascending: true, nullsFirst: false })
    .limit(200);
  if (scope !== 'team') query = query.eq('owner_id', ctx.user.id);
  const { data: tasks } = await query;

  const now = new Date();
  const endOfToday = new Date(now);
  // End of the day in Jakarta (UTC+7).
  endOfToday.setUTCHours(16, 59, 59, 999);
  if (endOfToday < now) endOfToday.setUTCDate(endOfToday.getUTCDate() + 1);

  const groups = [
    { title: 'Overdue', items: (tasks ?? []).filter((t) => t.due_at && new Date(t.due_at) < now) },
    { title: 'Today', items: (tasks ?? []).filter((t) => t.due_at && new Date(t.due_at) >= now && new Date(t.due_at) <= endOfToday) },
    { title: 'Upcoming', items: (tasks ?? []).filter((t) => !t.due_at || new Date(t.due_at) > endOfToday) },
  ];

  return (
    <>
      <PageHeader
        title="Tasks"
        description="Follow-ups and reminders. Add them from a contact page."
        actions={
          <div className="flex rounded-control border border-border-strong bg-surface p-0.5 text-sm">
            {[
              { value: 'mine', label: 'Mine' },
              { value: 'team', label: 'Whole team' },
            ].map((option) => (
              <Link
                key={option.value}
                href={`/o/${orgId}/tasks?scope=${option.value}`}
                aria-current={scope === option.value || (option.value === 'mine' && scope !== 'team') ? 'page' : undefined}
                className="rounded-[0.375rem] px-3 py-1.5 font-medium text-muted aria-[current=page]:bg-primary-soft aria-[current=page]:text-primary-ink"
              >
                {option.label}
              </Link>
            ))}
          </div>
        }
      />
      <div className="space-y-4">
        {groups.map((group) => (
          <Card key={group.title}>
            <CardHeader title={`${group.title} (${group.items.length})`} />
            {group.items.length ? (
              <ul className="divide-y divide-border">
                {group.items.map((task) => (
                  <li key={task.id} className="flex items-start gap-3 px-4 py-3 text-sm">
                    <form action={toggleTask.bind(null, orgId)}>
                      <input type="hidden" name="id" value={task.id} />
                      <input type="hidden" name="done" value="true" />
                      <button
                        disabled={!canEdit(ctx, task.owner_id)}
                        aria-label={`Mark "${task.subject}" done`}
                        className="mt-0.5 h-4 w-4 rounded border border-border-strong hover:border-primary disabled:opacity-40"
                      />
                    </form>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{task.subject}</p>
                      <p className="text-xs text-muted">
                        {task.contacts ? (
                          <Link href={`/o/${orgId}/contacts/${task.contacts.id}`} className="hover:underline">
                            {task.contacts.full_name}
                          </Link>
                        ) : (
                          'No contact'
                        )}
                        {scope === 'team' ? ` · ${task.profiles?.full_name ?? 'Unassigned'}` : ''}
                      </p>
                    </div>
                    {task.due_at ? (
                      <time dateTime={task.due_at} title={formatDateTime(task.due_at)} className={`shrink-0 text-xs ${group.title === 'Overdue' ? 'text-danger' : 'text-muted'}`}>
                        {formatRelativeDays(task.due_at)}
                      </time>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title={group.title === 'Overdue' ? 'Nothing overdue' : 'Nothing here'} />
            )}
          </Card>
        ))}
      </div>
    </>
  );
}

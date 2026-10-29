import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { isAdmin, requireOrg } from '@/lib/org';
import { SettingsNav } from '../SettingsNav';

export const metadata: Metadata = { title: 'Audit log' };

const PAGE_SIZE = 50;
const ENTITY_LABEL: Record<string, string> = {
  contacts: 'contact',
  companies: 'company',
  deals: 'deal',
  pipeline_stages: 'stage',
  memberships: 'membership',
  invitations: 'invitation',
};
const actionTone = { insert: 'success', update: 'primary', delete: 'danger' } as const;

/** One line per change: the record's name and, for updates, the fields that changed. */
function describe(entity: string, action: string, changes: Record<string, unknown>): string {
  const name = changes.full_name ?? changes.title ?? changes.name ?? changes.email ?? changes.role;
  const label = typeof name === 'string' ? ` "${name}"` : '';
  if (action !== 'update') return `${ENTITY_LABEL[entity] ?? entity}${label}`;
  const fields = Object.keys(changes).map((key) => key.replace(/_id$/, '').replace(/_/g, ' '));
  return `${ENTITY_LABEL[entity] ?? entity}${label}: ${fields.join(', ')}`;
}

export default async function AuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { orgId } = await params;
  const { page = '1' } = await searchParams;
  const { supabase, role } = await requireOrg(orgId);
  if (!isAdmin(role)) notFound();
  const pageNumber = Math.max(1, Number.parseInt(page, 10) || 1);

  const { data: entries } = await supabase
    .from('audit_log')
    .select('id, action, entity, changes, created_at, profiles (full_name, email)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .range((pageNumber - 1) * PAGE_SIZE, pageNumber * PAGE_SIZE);
  const hasMore = (entries?.length ?? 0) > PAGE_SIZE;

  return (
    <>
      <PageHeader title="Settings" />
      <SettingsNav orgId={orgId} current="audit" isOwner={role === 'owner'} isAdmin />
      <Card>
        {entries?.length ? (
          <ul className="divide-y divide-border">
            {entries.slice(0, PAGE_SIZE).map((e) => (
              <li key={e.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 text-sm">
                <p className="min-w-0">
                  <span className="font-medium">{e.profiles?.full_name ?? e.profiles?.email ?? 'System'}</span>{' '}
                  <Badge tone={actionTone[e.action as keyof typeof actionTone]}>{e.action === 'insert' ? 'created' : `${e.action}d`}</Badge>{' '}
                  <span className="text-muted">{describe(e.entity, e.action, (e.changes ?? {}) as Record<string, unknown>)}</span>
                </p>
                <time dateTime={e.created_at} className="shrink-0 text-xs text-muted">
                  {formatDateTime(e.created_at)}
                </time>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No changes recorded yet" />
        )}
      </Card>
      <nav aria-label="Pages" className="mt-3 flex justify-between text-sm">
        {pageNumber > 1 ? (
          <Link href={`?page=${pageNumber - 1}`} className="text-primary hover:underline">
            ← Newer
          </Link>
        ) : (
          <span />
        )}
        {hasMore ? (
          <Link href={`?page=${pageNumber + 1}`} className="text-primary hover:underline">
            Older →
          </Link>
        ) : null}
      </nav>
    </>
  );
}

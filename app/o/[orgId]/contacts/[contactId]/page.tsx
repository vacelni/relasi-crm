import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Alert, Badge, Card, CardHeader, EmptyState, statusLabel, statusTone } from '@/components/ui';
import { deleteActivity, toggleTask } from '@/features/activities/actions';
import { deleteContact } from '@/features/contacts/actions';
import { isUuid } from '@/lib/errors';
import { ACTIVITY_KIND_LABEL, formatDate, formatDateTime, formatRelativeDays, formatRupiah, whatsappLink } from '@/lib/format';
import { canEdit, isAdmin, requireOrg } from '@/lib/org';
import { NewDealForm } from '../../pipeline/NewDealForm';
import { ActivityForm } from './ActivityForm';
import { AiPanel, type StoredScore } from './AiPanel';
import { ContactEditForm } from './ContactEditForm';

export const metadata: Metadata = { title: 'Contact' };

export default async function ContactPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string; contactId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { orgId, contactId } = await params;
  const { error } = await searchParams;
  if (!isUuid(contactId)) notFound();
  const ctx = await requireOrg(orgId);
  const { supabase } = ctx;

  const [contactResult, companies, stages, deals, activities] = await Promise.all([
    supabase
      .from('contacts')
      .select('*, companies (id, name), profiles (full_name)')
      .eq('id', contactId)
      .eq('org_id', orgId)
      .maybeSingle(),
    supabase.from('companies').select('id, name').eq('org_id', orgId).order('name').limit(1000),
    supabase.from('pipeline_stages').select('id, name, kind, probability').eq('org_id', orgId).order('position'),
    supabase
      .from('deals')
      .select('id, title, value, expected_close, pipeline_stages (name, kind)')
      .eq('contact_id', contactId)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false }),
    supabase
      .from('activities')
      .select('id, kind, subject, body, due_at, completed_at, created_at, owner_id, profiles (full_name)')
      .eq('contact_id', contactId)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);
  const contact = contactResult.data;
  if (!contact) notFound();

  const editable = canEdit(ctx, contact.owner_id);
  const wa = contact.phone ? whatsappLink(contact.phone) : null;
  const openTasks = (activities.data ?? []).filter((a) => a.kind === 'task' && !a.completed_at);
  const timeline = (activities.data ?? []).filter((a) => !(a.kind === 'task' && !a.completed_at));
  const stageList = (stages.data ?? []).map((s) => ({ ...s, kind: s.kind as 'open' | 'won' | 'lost' }));

  return (
    <>
      <nav className="mb-3 text-sm">
        <Link href={`/o/${orgId}/contacts`} className="text-muted hover:text-foreground hover:underline">
          ← Contacts
        </Link>
      </nav>
      {error ? (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{contact.full_name}</h1>
          <p className="mt-1 text-sm text-muted">
            {[contact.title, contact.companies?.name].filter(Boolean).join(' at ') || 'No title or company'}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <Badge tone={statusTone[contact.status as keyof typeof statusTone]}>{statusLabel[contact.status as keyof typeof statusLabel]}</Badge>
            <span className="text-muted">Owner: {contact.profiles?.full_name ?? 'Unassigned'}</span>
            {contact.email ? (
              <a href={`mailto:${contact.email}`} className="text-primary hover:underline">
                {contact.email}
              </a>
            ) : null}
            {contact.phone ? (
              wa ? (
                <a href={wa} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  {contact.phone} (WhatsApp)
                </a>
              ) : (
                <span>{contact.phone}</span>
              )
            ) : null}
          </div>
        </div>
        {isAdmin(ctx.role) ? (
          <form action={deleteContact.bind(null, orgId, contactId)}>
            <button className="text-sm text-danger hover:underline">Delete contact</button>
          </form>
        ) : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <AiPanel
            orgId={orgId}
            contactId={contactId}
            hasPhone={Boolean(wa)}
            phone={contact.phone}
            email={contact.email}
            summary={contact.ai_summary}
            score={contact.ai_score}
            scoreDetails={contact.ai_score_reasons as StoredScore | null}
            updatedAt={contact.ai_updated_at}
          />

          <Card>
            <CardHeader title="Log an interaction or add a task" />
            <div className="p-4">
              <ActivityForm orgId={orgId} contactId={contactId} deals={(deals.data ?? []).map((d) => ({ id: d.id, title: d.title }))} />
            </div>
          </Card>

          <Card>
            <CardHeader title="History" description={`${timeline.length} entries`} />
            {timeline.length ? (
              <ol className="divide-y divide-border">
                {timeline.map((a) => (
                  <li key={a.id} className="px-4 py-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <p>
                        <Badge>{ACTIVITY_KIND_LABEL[a.kind] ?? a.kind}</Badge> <span className="font-medium">{a.subject}</span>
                      </p>
                      {canEdit(ctx, a.owner_id) ? (
                        <form action={deleteActivity.bind(null, orgId)}>
                          <input type="hidden" name="id" value={a.id} />
                          <button className="text-xs text-muted hover:text-danger" aria-label={`Delete "${a.subject}"`}>
                            Delete
                          </button>
                        </form>
                      ) : null}
                    </div>
                    {a.body ? <p className="mt-1 whitespace-pre-line text-muted">{a.body}</p> : null}
                    <p className="mt-1 text-xs text-muted">
                      {a.profiles?.full_name ?? 'Someone'} · {formatDateTime(a.created_at)}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState title="No interactions yet">Log a call, meeting, or message above.</EmptyState>
            )}
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Open tasks" />
            {openTasks.length ? (
              <ul className="divide-y divide-border">
                {openTasks.map((t) => (
                  <li key={t.id} className="flex items-start gap-3 px-4 py-3 text-sm">
                    <form action={toggleTask.bind(null, orgId)}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="done" value="true" />
                      <button
                        disabled={!canEdit(ctx, t.owner_id)}
                        aria-label={`Mark "${t.subject}" done`}
                        className="mt-0.5 h-4 w-4 rounded border border-border-strong hover:border-primary disabled:opacity-40"
                      />
                    </form>
                    <div className="min-w-0">
                      <p className="font-medium">{t.subject}</p>
                      <p className={`text-xs ${t.due_at && new Date(t.due_at) < new Date() ? 'text-danger' : 'text-muted'}`}>
                        Due {t.due_at ? formatRelativeDays(t.due_at) : 'any time'} · {t.profiles?.full_name ?? 'Unassigned'}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No open tasks" />
            )}
          </Card>

          <Card>
            <CardHeader title="Deals" />
            {deals.data?.length ? (
              <ul className="divide-y divide-border">
                {deals.data.map((d) => (
                  <li key={d.id} className="px-4 py-3 text-sm">
                    <p className="font-medium">{d.title}</p>
                    <p className="text-xs text-muted">
                      {formatRupiah(d.value)} · {d.pipeline_stages?.name}
                      {d.expected_close ? ` · close by ${formatDate(d.expected_close)}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No deals yet" />
            )}
            <div className="border-t border-border p-2">
              <NewDealForm orgId={orgId} stages={stageList} contacts={[]} contactId={contactId} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Details" description={editable ? undefined : 'Read-only: owned by a teammate.'} />
            <div className="p-4">
              <ContactEditForm
                orgId={orgId}
                contactId={contactId}
                editable={editable}
                companies={companies.data ?? []}
                contact={{
                  full_name: contact.full_name,
                  email: contact.email,
                  phone: contact.phone,
                  title: contact.title,
                  company_id: contact.company_id,
                  status: contact.status,
                  notes: contact.notes,
                }}
              />
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

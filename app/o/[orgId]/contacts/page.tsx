import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, ButtonLink, Card, EmptyState, inputClass, PageHeader, statusLabel, statusTone } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { requireOrg } from '@/lib/org';
import { ExtractContacts } from './ExtractContacts';
import { NewContactForm } from './NewContactForm';

export const metadata: Metadata = { title: 'Contacts' };

const PAGE_SIZE = 50;
const STATUSES = ['lead', 'qualified', 'customer', 'churned'] as const;

export default async function ContactsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { orgId } = await params;
  const { q = '', status = '', mine = '', page = '1' } = await searchParams;
  const { supabase, user } = await requireOrg(orgId);
  const pageNumber = Math.max(1, Number.parseInt(page, 10) || 1);
  const base = `/o/${orgId}/contacts`;

  let query = supabase
    .from('contacts')
    .select('id, full_name, email, phone, title, status, ai_score, created_at, companies (name), profiles (full_name)', { count: 'exact' })
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .range((pageNumber - 1) * PAGE_SIZE, pageNumber * PAGE_SIZE - 1);
  const term = q.trim().slice(0, 80);
  if (term) {
    // Escape the characters PostgREST's or() filter syntax treats specially.
    const safe = term.replace(/[%_\\,()."]/g, ' ');
    query = query.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%`);
  }
  if ((STATUSES as readonly string[]).includes(status)) query = query.eq('status', status);
  if (mine === '1') query = query.eq('owner_id', user.id);

  const [contacts, companies] = await Promise.all([
    query,
    supabase.from('companies').select('id, name').eq('org_id', orgId).order('name').limit(1000),
  ]);
  const total = contacts.count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (n: number) => `${base}?${new URLSearchParams({ ...(q && { q }), ...(status && { status }), ...(mine && { mine }), page: String(n) })}`;

  return (
    <>
      <PageHeader
        title="Contacts"
        description={`${total} ${total === 1 ? 'contact' : 'contacts'}`}
        actions={
          <ButtonLink href={`/o/${orgId}/import`} variant="secondary" size="sm">
            Import CSV
          </ButtonLink>
        }
      />

      <div className="mb-4 grid gap-3 lg:grid-cols-2">
        <NewContactForm orgId={orgId} companies={companies.data ?? []} />
        <ExtractContacts orgId={orgId} />
      </div>

      <form className="mb-3 flex flex-wrap gap-2" role="search">
        <input name="q" defaultValue={q} placeholder="Search name, email, phone" aria-label="Search contacts" className={`${inputClass} max-w-xs`} />
        <select name="status" defaultValue={status} aria-label="Status" className={`${inputClass} w-auto`}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s} className="capitalize">
              {s}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" name="mine" value="1" defaultChecked={mine === '1'} /> Mine only
        </label>
        <button className="h-10 rounded-control border border-border-strong bg-surface px-4 text-sm font-medium hover:bg-subtle">Filter</button>
      </form>

      <Card className="overflow-hidden">
        {contacts.data?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-subtle text-left text-xs font-medium text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Company</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">AI score</th>
                  <th className="hidden px-4 py-2 font-medium md:table-cell">Owner</th>
                  <th className="hidden px-4 py-2 font-medium md:table-cell">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {contacts.data.map((c) => (
                  <tr key={c.id} className="hover:bg-subtle/60">
                    <td className="px-4 py-2.5">
                      <Link href={`${base}/${c.id}`} className="font-medium hover:underline">
                        {c.full_name}
                      </Link>
                      <p className="text-xs text-muted">{c.email ?? c.phone ?? c.title ?? ''}</p>
                    </td>
                    <td className="px-4 py-2.5 text-muted">{c.companies?.name ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <Badge tone={statusTone[c.status as keyof typeof statusTone]}>{statusLabel[c.status as keyof typeof statusLabel]}</Badge>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">{c.ai_score ?? <span className="text-muted">—</span>}</td>
                    <td className="hidden px-4 py-2.5 text-muted md:table-cell">{c.profiles?.full_name ?? 'Unassigned'}</td>
                    <td className="hidden px-4 py-2.5 text-muted md:table-cell">{formatDate(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title={term || status || mine ? 'No contacts match' : 'No contacts yet'}>
            {term || status || mine ? 'Try a different search.' : 'Add one above, paste a business card, or import a CSV.'}
          </EmptyState>
        )}
      </Card>

      {pages > 1 ? (
        <nav aria-label="Pages" className="mt-3 flex items-center justify-between text-sm">
          {pageNumber > 1 ? <Link href={pageHref(pageNumber - 1)} className="text-primary hover:underline">← Previous</Link> : <span />}
          <span className="text-muted">
            Page {pageNumber} of {pages}
          </span>
          {pageNumber < pages ? <Link href={pageHref(pageNumber + 1)} className="text-primary hover:underline">Next →</Link> : <span />}
        </nav>
      ) : null}
    </>
  );
}

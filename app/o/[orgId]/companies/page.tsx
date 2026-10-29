import type { Metadata } from 'next';
import { Alert, Card, EmptyState, PageHeader } from '@/components/ui';
import { deleteCompany } from '@/features/contacts/actions';
import { formatRupiahShort } from '@/lib/format';
import { isAdmin, requireOrg } from '@/lib/org';
import { NewCompanyForm } from './NewCompanyForm';

export const metadata: Metadata = { title: 'Companies' };

export default async function CompaniesPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { orgId } = await params;
  const { error } = await searchParams;
  const ctx = await requireOrg(orgId);

  const [companies, deals] = await Promise.all([
    ctx.supabase.from('companies').select('id, name, domain, industry, contacts (count)').eq('org_id', orgId).order('name'),
    ctx.supabase.from('deals').select('company_id, value, pipeline_stages (kind)').eq('org_id', orgId).not('company_id', 'is', null),
  ]);

  const openValue = new Map<string, number>();
  for (const deal of deals.data ?? []) {
    if (deal.pipeline_stages?.kind === 'open' && deal.company_id) {
      openValue.set(deal.company_id, (openValue.get(deal.company_id) ?? 0) + deal.value);
    }
  }

  return (
    <>
      <PageHeader title="Companies" description="Shared by the whole team. Contacts and deals link to them." />
      {error ? (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}
      <NewCompanyForm orgId={orgId} />
      <Card className="overflow-hidden">
        {companies.data?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-subtle text-left text-xs text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Industry</th>
                  <th className="px-4 py-2 font-medium">Contacts</th>
                  <th className="px-4 py-2 font-medium">Open pipeline</th>
                  {isAdmin(ctx.role) ? <th className="px-4 py-2" /> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {companies.data.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{c.name}</p>
                      {c.domain ? <p className="text-xs text-muted">{c.domain}</p> : null}
                    </td>
                    <td className="px-4 py-2.5 text-muted">{c.industry ?? '—'}</td>
                    <td className="px-4 py-2.5 tabular-nums">{c.contacts[0]?.count ?? 0}</td>
                    <td className="px-4 py-2.5 tabular-nums">{openValue.has(c.id) ? formatRupiahShort(openValue.get(c.id)!) : '—'}</td>
                    {isAdmin(ctx.role) ? (
                      <td className="px-4 py-2.5 text-right">
                        <form action={deleteCompany.bind(null, orgId)}>
                          <input type="hidden" name="id" value={c.id} />
                          <button className="text-xs text-muted hover:text-danger" aria-label={`Delete ${c.name}`}>
                            Delete
                          </button>
                        </form>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No companies yet">Add one above, or import contacts with a company column.</EmptyState>
        )}
      </Card>
    </>
  );
}

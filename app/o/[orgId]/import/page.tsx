import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
import { requireOrg } from '@/lib/org';
import { Importer } from './Importer';

export const metadata: Metadata = { title: 'Import contacts' };

export default async function ImportPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  await requireOrg(orgId);
  return (
    <>
      <PageHeader
        title="Import contacts"
        description="Upload a CSV export from a spreadsheet, Google Contacts, or another CRM. You will see a preview before anything is saved."
      />
      <Importer orgId={orgId} />
    </>
  );
}

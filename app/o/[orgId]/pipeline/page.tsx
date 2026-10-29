import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
import { canEdit, requireOrg } from '@/lib/org';
import { Board, type BoardDeal, type BoardStage } from './Board';
import { NewDealForm } from './NewDealForm';

export const metadata: Metadata = { title: 'Pipeline' };

export default async function PipelinePage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const ctx = await requireOrg(orgId);
  const { supabase } = ctx;

  const [stages, deals, contacts] = await Promise.all([
    supabase.from('pipeline_stages').select('id, name, kind, probability').eq('org_id', orgId).order('position'),
    supabase
      .from('deals')
      .select('id, title, value, stage_id, position, expected_close, owner_id, contacts (id, full_name), profiles (full_name)')
      .eq('org_id', orgId)
      .order('position'),
    supabase.from('contacts').select('id, full_name').eq('org_id', orgId).order('full_name').limit(1000),
  ]);

  const boardStages: BoardStage[] = (stages.data ?? []).map((s) => ({ ...s, kind: s.kind as BoardStage['kind'] }));
  const boardDeals: BoardDeal[] = (deals.data ?? []).map((d) => ({
    id: d.id,
    title: d.title,
    value: d.value,
    stageId: d.stage_id,
    position: d.position,
    expectedClose: d.expected_close,
    contact: d.contacts,
    ownerName: d.profiles?.full_name ?? null,
    editable: canEdit(ctx, d.owner_id),
  }));

  return (
    <>
      <PageHeader
        title="Pipeline"
        description={
          ctx.role === 'sales'
            ? 'Drag your deals between stages. Deals owned by teammates are read-only for the sales role.'
            : 'Drag deals between stages. Moving a deal to Won or Lost closes it.'
        }
      />
      <NewDealForm orgId={orgId} stages={boardStages} contacts={contacts.data ?? []} />
      <Board orgId={orgId} stages={boardStages} initialDeals={boardDeals} />
    </>
  );
}

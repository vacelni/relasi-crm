'use server';

import { revalidatePath } from 'next/cache';
import type { FormState } from '@/components/forms';
import { friendlyDbError, isUuid, type ActionResult } from '@/lib/errors';
import { requireOrg } from '@/lib/org';
import { dealSchema, fieldErrors, formValues } from '@/lib/validation';

const DEAL_KEYS = ['title', 'value', 'stage_id', 'contact_id', 'expected_close'] as const;

export async function createDeal(orgId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = dealSchema.safeParse(formValues(formData, DEAL_KEYS));
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };
  const { supabase } = await requireOrg(orgId);

  // The deal joins the contact's company, and goes to the bottom of its column.
  let companyId: string | null = null;
  if (parsed.data.contact_id) {
    const { data: contact } = await supabase.from('contacts').select('company_id').eq('id', parsed.data.contact_id).eq('org_id', orgId).maybeSingle();
    companyId = contact?.company_id ?? null;
  }
  const { data: last } = await supabase
    .from('deals')
    .select('position')
    .eq('org_id', orgId)
    .eq('stage_id', parsed.data.stage_id)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from('deals').insert({
    org_id: orgId,
    ...parsed.data,
    company_id: companyId,
    position: (last?.position ?? 0) + 1,
  });
  if (error) return { error: friendlyDbError(error) };
  revalidatePath(`/o/${orgId}`, 'layout');
  return { ok: true, message: `Deal "${parsed.data.title}" added.` };
}

/** A Kanban drop: new stage and fractional position (between its new neighbours). */
export async function moveDeal(orgId: string, dealId: string, stageId: string, position: number): Promise<ActionResult> {
  if (!isUuid(dealId) || !isUuid(stageId) || !Number.isFinite(position)) return { ok: false, error: 'Invalid move.' };
  const { supabase } = await requireOrg(orgId);
  const { data, error } = await supabase
    .from('deals')
    .update({ stage_id: stageId, position })
    .eq('id', dealId)
    .eq('org_id', orgId)
    .select('id');
  if (error) return { ok: false, error: friendlyDbError(error) };
  if (!data.length) return { ok: false, error: 'Only the deal owner or an admin can move this deal.' };
  revalidatePath(`/o/${orgId}`, 'layout');
  return { ok: true, data: undefined };
}

export async function deleteDeal(orgId: string, formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  if (!isUuid(id)) return;
  const { supabase } = await requireOrg(orgId);
  await supabase.from('deals').delete().eq('id', id).eq('org_id', orgId);
  revalidatePath(`/o/${orgId}`, 'layout');
}

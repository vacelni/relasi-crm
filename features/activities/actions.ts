'use server';

import { revalidatePath } from 'next/cache';
import type { FormState } from '@/components/forms';
import { friendlyDbError, isUuid } from '@/lib/errors';
import { requireOrg } from '@/lib/org';
import { activitySchema, fieldErrors, formValues } from '@/lib/validation';

/** Logs an interaction or creates a task on a contact (and optionally one of its deals). */
export async function logActivity(orgId: string, contactId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  if (!isUuid(contactId)) return { error: 'Contact not found.' };
  const parsed = activitySchema.safeParse(formValues(formData, ['kind', 'subject', 'body', 'due_at']));
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };
  const dealId = String(formData.get('deal_id') ?? '');
  const isTask = parsed.data.kind === 'task';
  if (isTask && !parsed.data.due_at) return { fields: { due_at: 'Tasks need a due date.' } };

  const { supabase } = await requireOrg(orgId);
  const { error } = await supabase.from('activities').insert({
    org_id: orgId,
    contact_id: contactId,
    deal_id: isUuid(dealId) ? dealId : null,
    ...parsed.data,
    // Interactions are things that happened; tasks are open until completed.
    completed_at: isTask ? null : new Date().toISOString(),
  });
  if (error) return { error: friendlyDbError(error) };
  revalidatePath(`/o/${orgId}`, 'layout');
  return { ok: true, message: isTask ? 'Task added.' : 'Logged.' };
}

export async function toggleTask(orgId: string, formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  if (!isUuid(id)) return;
  const done = formData.get('done') === 'true';
  const { supabase } = await requireOrg(orgId);
  await supabase
    .from('activities')
    .update({ completed_at: done ? new Date().toISOString() : null })
    .eq('id', id)
    .eq('org_id', orgId);
  revalidatePath(`/o/${orgId}`, 'layout');
}

export async function deleteActivity(orgId: string, formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  if (!isUuid(id)) return;
  const { supabase } = await requireOrg(orgId);
  await supabase.from('activities').delete().eq('id', id).eq('org_id', orgId);
  revalidatePath(`/o/${orgId}`, 'layout');
}

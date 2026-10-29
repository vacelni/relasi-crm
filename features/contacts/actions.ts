'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { FormState } from '@/components/forms';
import { CONTACT_FIELDS, type ImportRow } from '@/lib/csv';
import { friendlyDbError, isUuid, type ActionResult } from '@/lib/errors';
import { requireOrg } from '@/lib/org';
import { companySchema, contactSchema, fieldErrors, formValues } from '@/lib/validation';

const CONTACT_KEYS = ['full_name', 'email', 'phone', 'title', 'company_id', 'status', 'source', 'notes'] as const;

export async function createContact(orgId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, CONTACT_KEYS);
  const parsed = contactSchema.safeParse({ ...values, source: values.source || 'manual' });
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };
  const { supabase } = await requireOrg(orgId);
  const { data, error } = await supabase
    .from('contacts')
    .insert({ org_id: orgId, ...parsed.data })
    .select('id')
    .single();
  if (error) return { error: friendlyDbError(error) };
  revalidatePath(`/o/${orgId}`, 'layout');
  redirect(`/o/${orgId}/contacts/${data.id}`);
}

export async function updateContact(orgId: string, contactId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  if (!isUuid(contactId)) return { error: 'Contact not found.' };
  // Source is set at creation; the edit form does not change it.
  const parsed = contactSchema.omit({ source: true }).safeParse(formValues(formData, CONTACT_KEYS));
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };
  const { supabase } = await requireOrg(orgId);
  const { data: rows, error } = await supabase.from('contacts').update(parsed.data).eq('id', contactId).eq('org_id', orgId).select('id');
  if (error) return { error: friendlyDbError(error) };
  if (!rows.length) return { error: 'Only the contact owner or an admin can edit this contact.' };
  revalidatePath(`/o/${orgId}`, 'layout');
  return { ok: true, message: 'Saved.' };
}

export async function deleteContact(orgId: string, contactId: string): Promise<void> {
  if (!isUuid(contactId)) return;
  const { supabase } = await requireOrg(orgId);
  const { data, error } = await supabase.from('contacts').delete().eq('id', contactId).eq('org_id', orgId).select('id');
  if (error || !data.length) {
    redirect(`/o/${orgId}/contacts/${contactId}?error=${encodeURIComponent(error ? friendlyDbError(error) : 'Only admins can delete contacts.')}`);
  }
  revalidatePath(`/o/${orgId}`, 'layout');
  redirect(`/o/${orgId}/contacts`);
}

export async function createCompany(orgId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = companySchema.safeParse(formValues(formData, ['name', 'domain', 'industry']));
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };
  const { supabase } = await requireOrg(orgId);
  const { error } = await supabase.from('companies').insert({ org_id: orgId, ...parsed.data });
  if (error) return { error: friendlyDbError(error) };
  revalidatePath(`/o/${orgId}/companies`);
  return { ok: true, message: `${parsed.data.name} added.` };
}

export async function deleteCompany(orgId: string, formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  if (!isUuid(id)) return;
  const { supabase } = await requireOrg(orgId);
  const { data, error } = await supabase.from('companies').delete().eq('id', id).eq('org_id', orgId).select('id');
  if (error || !data.length) {
    redirect(`/o/${orgId}/companies?error=${encodeURIComponent(error ? friendlyDbError(error) : 'Only admins can delete companies.')}`);
  }
  revalidatePath(`/o/${orgId}`, 'layout');
}

/** Bulk insert from the CSV importer or the AI extractor (rows validated client-side and again in SQL). */
export async function importContacts(
  orgId: string,
  rows: ImportRow[],
  source: 'import' | 'ai_extract',
): Promise<ActionResult<{ inserted: number; skipped: number }>> {
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, error: 'Nothing to import.' };
  if (rows.length > 1000) return { ok: false, error: 'Import at most 1000 rows at a time.' };
  // Keep only known fields: the payload comes from the browser.
  const clean = rows.map((row) =>
    Object.fromEntries(CONTACT_FIELDS.flatMap((field) => (typeof row[field] === 'string' ? [[field, row[field]!.slice(0, 4000)]] : []))),
  );
  if (clean.some((row) => !row.full_name?.trim())) return { ok: false, error: 'Every row needs a name.' };

  const { supabase } = await requireOrg(orgId);
  const { data, error } = await supabase.rpc('import_contacts', { p_org: orgId, p_rows: clean, p_source: source });
  if (error) return { ok: false, error: friendlyDbError(error) };
  revalidatePath(`/o/${orgId}`, 'layout');
  return { ok: true, data: data as { inserted: number; skipped: number } };
}

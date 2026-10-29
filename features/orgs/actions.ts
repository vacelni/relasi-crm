'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { FormState } from '@/components/forms';
import { friendlyDbError, isUuid } from '@/lib/errors';
import { requireOrg, requireUser } from '@/lib/org';
import { fieldErrors, inviteSchema, orgNameSchema } from '@/lib/validation';

export async function createOrganization(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = orgNameSchema.safeParse({ name: formData.get('name') });
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc('create_organization', { p_name: parsed.data.name });
  if (error) return { error: friendlyDbError(error) };
  redirect(`/o/${data}`);
}

export async function renameOrganization(orgId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = orgNameSchema.safeParse({ name: formData.get('name') });
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };
  const { supabase } = await requireOrg(orgId);
  const { data, error } = await supabase.from('organizations').update({ name: parsed.data.name }).eq('id', orgId).select('id');
  if (error) return { error: friendlyDbError(error) };
  if (!data.length) return { error: 'You do not have permission to do that.' };
  revalidatePath(`/o/${orgId}`, 'layout');
  return { ok: true, message: 'Saved.' };
}

export async function inviteMember(orgId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = inviteSchema.safeParse({ email: formData.get('email'), role: formData.get('role') });
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };
  const { supabase } = await requireOrg(orgId);
  const { error } = await supabase.from('invitations').insert({ org_id: orgId, ...parsed.data });
  if (error) return { error: friendlyDbError(error) };
  revalidatePath(`/o/${orgId}/settings`);
  return { ok: true, message: `Invitation created. Copy the link below and send it to ${parsed.data.email}.` };
}

export async function revokeInvitation(orgId: string, formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  if (!isUuid(id)) return;
  const { supabase } = await requireOrg(orgId);
  await supabase.from('invitations').delete().eq('id', id).eq('org_id', orgId);
  revalidatePath(`/o/${orgId}/settings`);
}

export async function setMemberRole(orgId: string, formData: FormData): Promise<void> {
  const userId = String(formData.get('user_id') ?? '');
  const role = String(formData.get('role') ?? '');
  if (!isUuid(userId)) return;
  const { supabase } = await requireOrg(orgId);
  const { error } = await supabase.rpc('set_member_role', { p_org: orgId, p_user: userId, p_role: role });
  if (error) redirect(`/o/${orgId}/settings?error=${encodeURIComponent(friendlyDbError(error))}`);
  revalidatePath(`/o/${orgId}/settings`);
}

export async function removeMember(orgId: string, formData: FormData): Promise<void> {
  const userId = String(formData.get('user_id') ?? '');
  if (!isUuid(userId)) return;
  const { supabase, user } = await requireOrg(orgId);
  const { error } = await supabase.rpc('remove_member', { p_org: orgId, p_user: userId });
  if (error) redirect(`/o/${orgId}/settings?error=${encodeURIComponent(friendlyDbError(error))}`);
  // Leaving the workspace: there is nothing left to show here.
  if (userId === user.id) redirect('/o');
  revalidatePath(`/o/${orgId}/settings`);
}

export async function acceptInvitation(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = String(formData.get('token') ?? '');
  if (!isUuid(token)) return { error: 'This invitation link is not valid.' };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc('accept_invitation', { p_token: token });
  if (error) return { error: friendlyDbError(error) };
  redirect(`/o/${data}`);
}

import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/org';

/** /o: the workspace the user joined first, or onboarding when they have none. */
export default async function WorkspacesIndex() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from('memberships')
    .select('org_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1);
  redirect(data?.[0] ? `/o/${data[0].org_id}` : '/onboarding');
}

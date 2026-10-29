import 'server-only';
import type { ContactContext } from '@/lib/ai/types';
import type { OrgContext } from '@/lib/org';

/** Everything the AI features read about one contact, loaded as the user (RLS applies). */
export async function loadContactContext(ctx: OrgContext, contactId: string): Promise<ContactContext | null> {
  const { supabase, org } = ctx;
  const [contact, deals, activities] = await Promise.all([
    supabase
      .from('contacts')
      .select('full_name, title, email, phone, status, source, notes, created_at, companies (name, industry)')
      .eq('id', contactId)
      .eq('org_id', org.id)
      .maybeSingle(),
    supabase
      .from('deals')
      .select('title, value, expected_close, pipeline_stages (name, kind, probability)')
      .eq('contact_id', contactId)
      .eq('org_id', org.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('activities')
      .select('kind, subject, body, created_at, due_at, completed_at')
      .eq('contact_id', contactId)
      .eq('org_id', org.id)
      .order('created_at', { ascending: false })
      .limit(60),
  ]);
  if (!contact.data) return null;

  const c = contact.data;
  return {
    now: new Date(),
    contact: {
      full_name: c.full_name,
      title: c.title,
      email: c.email,
      phone: c.phone,
      status: c.status as ContactContext['contact']['status'],
      source: c.source,
      notes: c.notes,
      created_at: c.created_at,
      company: c.companies ? { name: c.companies.name, industry: c.companies.industry } : null,
    },
    deals: (deals.data ?? []).map((d) => ({
      title: d.title,
      value: d.value,
      expected_close: d.expected_close,
      stage: d.pipeline_stages?.name ?? 'Unknown',
      stage_kind: (d.pipeline_stages?.kind ?? 'open') as 'open' | 'won' | 'lost',
      probability: d.pipeline_stages?.probability ?? 0,
    })),
    activities: activities.data ?? [],
  };
}

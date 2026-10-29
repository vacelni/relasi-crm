'use server';

import { redirect } from 'next/navigation';
import { friendlyDbError } from '@/lib/errors';
import { createSnapTransaction, midtransConfig } from '@/lib/midtrans';
import { requireOrg } from '@/lib/org';
import { siteOrigin } from '@/lib/site';

/** Owner-only: fixes the price in the database, then sends the owner to the Midtrans payment page. */
export async function startCheckout(orgId: string, formData: FormData): Promise<void> {
  const months = formData.get('months') === '12' ? 12 : 1;
  const back = `/o/${orgId}/settings/billing`;
  const config = midtransConfig();
  if (!config) redirect(`${back}?error=${encodeURIComponent('Payments are not configured on this server (MIDTRANS_SERVER_KEY).')}`);

  const { supabase, user } = await requireOrg(orgId);
  const { data: order, error } = await supabase.rpc('create_billing_order', { p_org: orgId, p_months: months });
  if (error || !order) redirect(`${back}?error=${encodeURIComponent(error ? friendlyDbError(error) : 'Could not start the payment.')}`);

  let redirectUrl: string;
  try {
    ({ redirectUrl } = await createSnapTransaction(config, {
      orderId: order.id,
      amount: order.amount,
      itemName: `Relasi Pro, ${months === 12 ? '12 months' : '1 month'}`,
      customerEmail: user.email,
      finishUrl: `${await siteOrigin()}${back}?paid=1`,
    }));
  } catch {
    redirect(`${back}?error=${encodeURIComponent('The payment provider is not responding. Try again later.')}`);
  }
  redirect(redirectUrl);
}

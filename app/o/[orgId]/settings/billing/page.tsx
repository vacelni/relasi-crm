import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Alert, Badge, Card, CardHeader, EmptyState, PageHeader } from '@/components/ui';
import { SubmitButton } from '@/components/forms';
import { startCheckout } from '@/features/billing/actions';
import { formatDate, formatDateTime, formatRupiah } from '@/lib/format';
import { midtransConfig } from '@/lib/midtrans';
import { effectivePlan, requireOrg } from '@/lib/org';
import { SettingsNav } from '../SettingsNav';

export const metadata: Metadata = { title: 'Plan & billing' };

const orderTone = { pending: 'warning', paid: 'success', failed: 'danger', expired: 'neutral' } as const;

export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { orgId } = await params;
  const { error, paid } = await searchParams;
  const { supabase, role, org } = await requireOrg(orgId);
  if (role !== 'owner') notFound();

  const plan = effectivePlan(org);
  const configured = midtransConfig() !== null;
  const sandbox = process.env.MIDTRANS_IS_PRODUCTION !== 'true';
  const { data: orders } = await supabase
    .from('billing_orders')
    .select('id, months, amount, status, created_at, paid_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(20);

  return (
    <>
      <PageHeader title="Settings" />
      <SettingsNav orgId={orgId} current="billing" isOwner isAdmin />
      <div className="space-y-4">
        {error ? <Alert>{error}</Alert> : null}
        {paid ? (
          <Alert tone="success">
            Thanks! Your plan updates as soon as Midtrans confirms the payment (usually within a minute). Refresh to check.
          </Alert>
        ) : null}
        {sandbox && configured ? (
          <Alert tone="warning">
            Sandbox mode: no real money moves. Pay with a Midtrans test method, e.g. card 4811 1111 1111 1114, any future
            expiry, CVV 123, OTP 112233.
          </Alert>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-5">
            <p className="text-sm font-medium text-muted">Current plan</p>
            <p className="mt-1 text-2xl font-semibold">{plan === 'pro' ? 'Pro' : 'Free'}</p>
            <p className="mt-1 text-sm text-muted">
              {plan === 'pro' && org.planExpiresAt ? `Paid until ${formatDate(org.planExpiresAt)}` : '3 seats · 30 AI calls a day'}
            </p>
          </Card>
          {[
            { months: 1, price: 149_000, label: 'Pro monthly', note: 'per month' },
            { months: 12, price: 1_490_000, label: 'Pro yearly', note: 'per year: two months free' },
          ].map((offer) => (
            <Card key={offer.months} className="flex flex-col p-5">
              <p className="text-sm font-medium text-muted">{offer.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{formatRupiah(offer.price)}</p>
              <p className="text-sm text-muted">{offer.note}</p>
              <ul className="mt-3 flex-1 space-y-1 text-sm">
                <li>25 seats</li>
                <li>500 AI calls a day</li>
                <li>{plan === 'pro' ? 'Extends your current period' : 'Starts right after payment'}</li>
              </ul>
              <form action={startCheckout.bind(null, orgId)} className="mt-4">
                <input type="hidden" name="months" value={offer.months} />
                <SubmitButton className="w-full" pendingText="Opening Midtrans…" disabled={!configured}>
                  {plan === 'pro' ? 'Extend' : 'Upgrade'}
                </SubmitButton>
              </form>
            </Card>
          ))}
        </div>
        {!configured ? (
          <p className="text-xs text-muted">Payments are disabled: set MIDTRANS_SERVER_KEY (sandbox keys are free) to enable checkout.</p>
        ) : null}

        <Card>
          <CardHeader title="Payments" />
          {orders?.length ? (
            <ul className="divide-y divide-border">
              {orders.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium">
                      Pro, {o.months === 12 ? '12 months' : '1 month'} · {formatRupiah(o.amount)}
                    </p>
                    <p className="text-xs text-muted">
                      {o.id} · {formatDateTime(o.created_at)}
                    </p>
                  </div>
                  <Badge tone={orderTone[o.status as keyof typeof orderTone]}>{o.status}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No payments yet" />
          )}
        </Card>
      </div>
    </>
  );
}

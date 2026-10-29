import { NextResponse } from 'next/server';
import { midtransConfig, orderStatus, parseGrossAmount, verifySignature, type MidtransNotification } from '@/lib/midtrans';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Midtrans payment notifications (Settings → Configuration → Payment Notification URL).
 * Unsigned or mis-signed requests are rejected; the amount is checked against the order in the
 * database; repeats are harmless (apply_billing_notification is idempotent).
 */
export async function POST(request: Request) {
  const config = midtransConfig();
  if (!config) return NextResponse.json({ error: 'payments not configured' }, { status: 503 });

  let notification: MidtransNotification;
  try {
    notification = (await request.json()) as MidtransNotification;
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  if (typeof notification?.order_id !== 'string' || !verifySignature(notification, config.serverKey)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }
  // Midtrans' own test notifications and other apps' orders on the same account.
  if (!notification.order_id.startsWith('relasi-')) return NextResponse.json({ ok: true, ignored: true });

  const status = orderStatus(notification);
  const amount = parseGrossAmount(notification.gross_amount);
  if (!status) return NextResponse.json({ ok: true, status: 'pending' });
  if (amount === null) return NextResponse.json({ error: 'invalid amount' }, { status: 400 });

  const { error } = await createAdminClient().rpc('apply_billing_notification', {
    p_order: notification.order_id,
    p_status: status,
    p_amount: amount,
    p_payload: notification as never,
  });
  if (error) {
    console.error('[midtrans] apply', notification.order_id, error.message);
    // 4xx for a mismatch Midtrans should not retry; 5xx so it retries anything else.
    const permanent = error.code === 'P0002' || error.code === '22023';
    return NextResponse.json({ error: 'not applied' }, { status: permanent ? 422 : 500 });
  }
  return NextResponse.json({ ok: true, status });
}

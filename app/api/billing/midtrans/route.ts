import { NextResponse } from 'next/server';
import {
  fetchTransactionStatus,
  midtransConfig,
  orderStatus,
  parseGrossAmount,
  verifySignature,
  type MidtransNotification,
  type TransactionStatus,
} from '@/lib/midtrans';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Midtrans payment notifications (Settings → Configuration → Payment Notification URL).
 *
 * The signature proves the request came from Midtrans, but it does not cover transaction_status,
 * so the status and amount applied come from Midtrans' status API, never from the body. The
 * database then checks the amount against the order; repeats are harmless (idempotent).
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
  if (typeof notification?.order_id !== 'string') return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  // Midtrans' own test notifications and other apps' orders on the same account. Nothing is read or
  // written for them, so they get a 200 before the signature check: the dashboard's test
  // notification is not signed with the server key, and a 4xx makes Midtrans email a failure.
  if (!notification.order_id.startsWith('relasi-')) return NextResponse.json({ ok: true, ignored: true });
  if (!verifySignature(notification, config.serverKey)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  let transaction: TransactionStatus;
  try {
    transaction = await fetchTransactionStatus(config, notification.order_id);
  } catch (error) {
    console.error('[midtrans] status', notification.order_id, error);
    // 5xx: Midtrans retries the notification later.
    return NextResponse.json({ error: 'status unavailable' }, { status: 502 });
  }
  if (transaction.order_id !== notification.order_id) return NextResponse.json({ error: 'order mismatch' }, { status: 422 });

  const status = orderStatus(transaction);
  if (!status) return NextResponse.json({ ok: true, status: 'pending' });
  const amount = parseGrossAmount(transaction.gross_amount);
  if (amount === null) return NextResponse.json({ error: 'invalid amount' }, { status: 422 });

  const { error } = await createAdminClient().rpc('apply_billing_notification', {
    p_order: transaction.order_id,
    p_status: status,
    p_amount: amount,
    p_payload: transaction as never,
  });
  if (error) {
    console.error('[midtrans] apply', transaction.order_id, error.message);
    // 4xx for a mismatch Midtrans should not retry; 5xx so it retries anything else.
    const permanent = error.code === 'P0002' || error.code === '22023';
    return NextResponse.json({ error: 'not applied' }, { status: permanent ? 422 : 500 });
  }
  return NextResponse.json({ ok: true, status });
}

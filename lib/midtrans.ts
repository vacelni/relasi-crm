import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Midtrans Snap (hosted payment page), sandbox by default. Only server code imports this: it
 * reads MIDTRANS_SERVER_KEY.
 *
 * Flow: the owner picks a plan → create_billing_order() fixes the price in the database →
 * createSnapTransaction() returns a payment page URL → Midtrans calls /api/billing/midtrans →
 * the signature is verified here and apply_billing_notification() checks the amount and
 * extends the plan.
 */

export type MidtransConfig = { serverKey: string; isProduction: boolean };

export function midtransConfig(): MidtransConfig | null {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) return null;
  return { serverKey, isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true' };
}

export type SnapRequest = {
  orderId: string;
  amount: number;
  itemName: string;
  customerEmail: string;
  finishUrl: string;
};

export async function createSnapTransaction(config: MidtransConfig, request: SnapRequest): Promise<{ redirectUrl: string }> {
  const host = config.isProduction ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com';
  const response = await fetch(`${host}/snap/v1/transactions`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${config.serverKey}:`).toString('base64')}`,
    },
    body: JSON.stringify({
      transaction_details: { order_id: request.orderId, gross_amount: request.amount },
      item_details: [{ id: 'relasi-pro', name: request.itemName, price: request.amount, quantity: 1 }],
      customer_details: { email: request.customerEmail },
      callbacks: { finish: request.finishUrl },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    console.error('[midtrans] snap', response.status, await response.text());
    throw new Error('The payment provider rejected the request.');
  }
  const body = (await response.json()) as { redirect_url?: string };
  if (!body.redirect_url) throw new Error('The payment provider returned no payment page.');
  return { redirectUrl: body.redirect_url };
}

export type MidtransNotification = {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  transaction_status: string;
  fraud_status?: string;
};

/** signature_key = SHA512(order_id + status_code + gross_amount + server key), compared in constant time. */
export function verifySignature(notification: MidtransNotification, serverKey: string): boolean {
  const expected = createHash('sha512')
    .update(`${notification.order_id}${notification.status_code}${notification.gross_amount}${serverKey}`)
    .digest('hex');
  const given = String(notification.signature_key ?? '');
  if (given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

export type TransactionStatus = Pick<MidtransNotification, 'order_id' | 'status_code' | 'gross_amount' | 'transaction_status' | 'fraud_status'>;

/**
 * The transaction as Midtrans records it. The notification's signature does not cover
 * transaction_status, so the webhook asks Midtrans directly instead of trusting the body.
 */
export async function fetchTransactionStatus(config: MidtransConfig, orderId: string): Promise<TransactionStatus> {
  const host = config.isProduction ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com';
  const response = await fetch(`${host}/v2/${encodeURIComponent(orderId)}/status`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Basic ${Buffer.from(`${config.serverKey}:`).toString('base64')}`,
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Midtrans status request failed (${response.status}).`);
  return (await response.json()) as TransactionStatus;
}

/** Midtrans transaction status → billing_orders.status (null: nothing to record yet). */
export function orderStatus(transaction: Pick<TransactionStatus, 'status_code' | 'transaction_status' | 'fraud_status'>) {
  switch (transaction.transaction_status) {
    case 'capture':
      // Card payments: "challenge" waits for a manual review in the Midtrans dashboard.
      return transaction.status_code === '200' && transaction.fraud_status === 'accept' ? 'paid' : null;
    case 'settlement':
      // 200 is Midtrans' success code; anything else is not a completed payment.
      return transaction.status_code === '200' ? 'paid' : null;
    case 'deny':
    case 'cancel':
    case 'failure':
      return 'failed';
    case 'expire':
      return 'expired';
    default:
      return null;
  }
}

/** "149000.00" → 149000. Midtrans sends IDR amounts with two decimals. */
export function parseGrossAmount(value: string): number | null {
  if (!/^\d+(\.00)?$/.test(value)) return null;
  return Number(value.split('.')[0]);
}

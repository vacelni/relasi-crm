import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { orderStatus, parseGrossAmount, verifySignature, type MidtransNotification } from './midtrans';

const serverKey = 'SB-Mid-server-test-fixture';

function signed(fields: Omit<MidtransNotification, 'signature_key'>): MidtransNotification {
  const signature_key = createHash('sha512')
    .update(`${fields.order_id}${fields.status_code}${fields.gross_amount}${serverKey}`)
    .digest('hex');
  return { ...fields, signature_key };
}

describe('verifySignature', () => {
  const notification = signed({ order_id: 'relasi-abc12345', status_code: '200', gross_amount: '149000.00', transaction_status: 'settlement' });

  it('accepts a notification signed with the server key', () => {
    expect(verifySignature(notification, serverKey)).toBe(true);
  });

  it('rejects a tampered amount', () => {
    expect(verifySignature({ ...notification, gross_amount: '1.00' }, serverKey)).toBe(false);
  });

  it('rejects a different key and a malformed signature', () => {
    expect(verifySignature(notification, 'SB-Mid-server-other')).toBe(false);
    expect(verifySignature({ ...notification, signature_key: 'abc' }, serverKey)).toBe(false);
  });
});

describe('orderStatus', () => {
  it('maps Midtrans statuses', () => {
    expect(orderStatus({ status_code: '200', transaction_status: 'settlement' })).toBe('paid');
    expect(orderStatus({ status_code: '200', transaction_status: 'capture', fraud_status: 'accept' })).toBe('paid');
    expect(orderStatus({ status_code: '201', transaction_status: 'capture', fraud_status: 'challenge' })).toBeNull();
    expect(orderStatus({ status_code: '201', transaction_status: 'pending' })).toBeNull();
    expect(orderStatus({ status_code: '407', transaction_status: 'expire' })).toBe('expired');
    expect(orderStatus({ status_code: '202', transaction_status: 'deny' })).toBe('failed');
  });

  it('never counts a payment as paid without the success code', () => {
    expect(orderStatus({ status_code: '201', transaction_status: 'settlement' })).toBeNull();
    expect(orderStatus({ status_code: '201', transaction_status: 'capture', fraud_status: 'accept' })).toBeNull();
  });
});

describe('parseGrossAmount', () => {
  it('reads whole rupiah amounts only', () => {
    expect(parseGrossAmount('149000.00')).toBe(149000);
    expect(parseGrossAmount('1490000')).toBe(1490000);
    expect(parseGrossAmount('149000.50')).toBeNull();
    expect(parseGrossAmount('-1')).toBeNull();
  });
});

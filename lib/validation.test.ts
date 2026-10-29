import { describe, expect, it } from 'vitest';
import { activitySchema, contactSchema, dealSchema, fieldErrors } from './validation';

describe('contactSchema', () => {
  it('normalizes empty optional fields to null and lowercases email', () => {
    const result = contactSchema.parse({
      full_name: '  Dewi Lestari ',
      email: 'Dewi@Example.COM',
      phone: '',
      title: '',
      company_id: '',
      status: 'lead',
      notes: '',
    });
    expect(result).toEqual({
      full_name: 'Dewi Lestari',
      email: 'dewi@example.com',
      phone: null,
      title: null,
      company_id: null,
      status: 'lead',
      source: 'manual',
      notes: null,
    });
  });

  it('reports field messages', () => {
    const result = contactSchema.safeParse({ full_name: '', email: 'x', phone: 'abc', title: '', company_id: '', status: 'lead', notes: '' });
    expect(result.success).toBe(false);
    expect(fieldErrors(result.error!)).toEqual({
      full_name: 'Name is required.',
      email: 'Enter a valid email.',
      phone: 'Enter a valid phone number.',
    });
  });
});

describe('dealSchema', () => {
  const base = { title: 'Website', stage_id: '1aaabd27-b4e9-4dc8-8be7-a369933462d2', contact_id: '', expected_close: '' };

  it('parses rupiah amounts and treats empty as zero', () => {
    expect(dealSchema.parse({ ...base, value: 'Rp 15.000.000' }).value).toBe(15_000_000);
    expect(dealSchema.parse({ ...base, value: '' }).value).toBe(0);
  });

  it('rejects amounts it cannot read', () => {
    expect(dealSchema.safeParse({ ...base, value: '15jt' }).success).toBe(false);
  });
});

describe('activitySchema', () => {
  it('reads datetime-local input as Jakarta time', () => {
    const result = activitySchema.parse({ kind: 'task', subject: 'Call back', body: '', due_at: '2026-11-02T09:00' });
    expect(result.due_at).toBe('2026-11-02T02:00:00.000Z');
  });
});

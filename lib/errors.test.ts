import { describe, expect, it } from 'vitest';
import { friendlyDbError, isUuid } from './errors';

describe('friendlyDbError', () => {
  it('names the duplicate that was hit', () => {
    expect(friendlyDbError({ code: '23505', message: 'duplicate key value violates unique constraint "contacts_org_email_idx"' })).toBe(
      'A contact with this email already exists.',
    );
  });

  it('hides generic RLS messages but shows RPC guard messages', () => {
    expect(friendlyDbError({ code: '42501', message: 'new row violates row-level security policy for table "contacts"' })).toBe(
      'You do not have permission to do that.',
    );
    expect(friendlyDbError({ code: '42501', message: 'only the owner can change roles' })).toBe('Only the owner can change roles.');
  });

  it('passes through business rule messages', () => {
    expect(friendlyDbError({ code: 'P0001', message: 'seat limit reached for this plan' })).toBe('Seat limit reached for this plan.');
  });

  it('never leaks unknown errors', () => {
    expect(friendlyDbError({ code: 'XX000', message: 'internal detail' })).toBe('Something went wrong. Please try again.');
  });
});

describe('isUuid', () => {
  it('accepts UUIDs only', () => {
    expect(isUuid('de000000-0000-4000-8000-000000000001')).toBe(true);
    expect(isUuid('../etc')).toBe(false);
  });
});

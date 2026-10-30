import { describe, expect, it } from 'vitest';
import { activityVerb, formatRelativeDays, formatRupiah, formatRupiahShort, parseRupiah, whatsappLink } from './format';

describe('rupiah', () => {
  it('formats whole rupiah with Indonesian grouping', () => {
    expect(formatRupiah(45_000_000)).toBe('Rp45.000.000');
    expect(formatRupiah(0)).toBe('Rp0');
  });

  it('shortens large amounts for charts and column totals', () => {
    expect(formatRupiahShort(45_000_000)).toBe('Rp45jt');
    expect(formatRupiahShort(27_500_000)).toBe('Rp27,5jt');
    expect(formatRupiahShort(1_200_000_000)).toBe('Rp1,2M');
    expect(formatRupiahShort(149_000)).toBe('Rp149rb');
    expect(formatRupiahShort(500)).toBe('Rp500');
  });

  it('parses what people type', () => {
    expect(parseRupiah('45.000.000')).toBe(45_000_000);
    expect(parseRupiah('Rp 45,000,000')).toBe(45_000_000);
    expect(parseRupiah('rp.150000')).toBe(150_000);
    expect(parseRupiah('12jt')).toBeNull();
    expect(parseRupiah('-5')).toBeNull();
    expect(parseRupiah('')).toBeNull();
  });
});

describe('formatRelativeDays', () => {
  // 30 Oct 2026, 23:30 in Jakarta.
  const now = new Date('2026-10-30T16:30:00Z');

  it('counts calendar days in Jakarta time', () => {
    expect(formatRelativeDays('2026-10-30T01:00:00Z', now)).toBe('today');
    // 31 Oct 00:30 WIB is already tomorrow in Jakarta.
    expect(formatRelativeDays('2026-10-30T17:30:00Z', now)).toBe('tomorrow');
    expect(formatRelativeDays('2026-10-29T10:00:00Z', now)).toBe('yesterday');
    expect(formatRelativeDays('2026-10-25T10:00:00Z', now)).toBe('5 days ago');
    expect(formatRelativeDays('2026-11-02T10:00:00Z', now)).toBe('in 3 days');
  });
});

describe('whatsappLink', () => {
  it('turns local numbers into international click-to-chat links', () => {
    expect(whatsappLink('0812-0000-1001')).toBe('https://wa.me/6281200001001');
    expect(whatsappLink('+62 812 0000 1001', 'Halo!')).toBe('https://wa.me/6281200001001?text=Halo!');
    expect(whatsappLink('123')).toBeNull();
  });
});

describe('activityVerb', () => {
  it('reads as a sentence for every kind', () => {
    expect(activityVerb('call')).toEqual({ verb: 'called', withContact: '' });
    expect(activityVerb('whatsapp')).toEqual({ verb: 'chatted on WhatsApp', withContact: 'with' });
    expect(activityVerb('note')).toEqual({ verb: 'added a note', withContact: 'on' });
  });

  it('falls back to a note for an unknown kind', () => {
    expect(activityVerb('fax').verb).toBe('added a note');
  });
});

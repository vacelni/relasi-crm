import { describe, expect, it } from 'vitest';
import { guessMapping, mapRows, parseCsv } from './csv';

describe('parseCsv', () => {
  it('parses quoted fields with separators, escaped quotes, and newlines', () => {
    const text = 'name,notes\n"Dewi, Lestari","Said ""yes""\nthen left"\r\nArif,ok\n';
    expect(parseCsv(text)).toEqual([
      ['name', 'notes'],
      ['Dewi, Lestari', 'Said "yes"\nthen left'],
      ['Arif', 'ok'],
    ]);
  });

  it('detects semicolon-separated exports and strips the byte order mark', () => {
    expect(parseCsv('﻿nama;email\nDewi;dewi@example.com')).toEqual([
      ['nama', 'email'],
      ['Dewi', 'dewi@example.com'],
    ]);
  });

  it('drops blank lines and keeps empty cells', () => {
    expect(parseCsv('a,b,c\n\n1,,3\n')).toEqual([
      ['a', 'b', 'c'],
      ['1', '', '3'],
    ]);
  });
});

describe('guessMapping', () => {
  it('maps English, Indonesian, and CRM export headers', () => {
    expect(guessMapping(['Nama Lengkap', 'E-mail', 'No HP', 'Jabatan', 'Perusahaan', 'Catatan', 'Kota'])).toEqual([
      'full_name',
      'email',
      'phone',
      'title',
      'company',
      'notes',
      null,
    ]);
  });

  it('maps a field to the first matching column only', () => {
    expect(guessMapping(['Phone', 'Mobile'])).toEqual(['phone', null]);
  });
});

describe('mapRows', () => {
  const mapping = guessMapping(['name', 'email', 'phone']);

  it('returns valid rows and reports invalid ones with their spreadsheet line', () => {
    const { rows, errors } = mapRows(
      [
        ['Dewi', 'DEWI@Example.com', '0812-0000-1001'],
        ['', 'nobody@example.com', ''],
        ['Arif', 'not-an-email', ''],
        ['Sari', 'dewi@example.com', ''],
        ['Budi', '', 'call me'],
      ],
      mapping,
    );
    expect(rows).toEqual([{ full_name: 'Dewi', email: 'dewi@example.com', phone: '0812-0000-1001' }]);
    expect(errors).toEqual([
      { line: 3, message: 'missing name' },
      { line: 4, message: 'invalid email "not-an-email"' },
      { line: 5, message: 'duplicate email "dewi@example.com"' },
      { line: 6, message: 'invalid phone "call me"' },
    ]);
  });

  it('caps an import at 1000 rows and says so', () => {
    const data = Array.from({ length: 1005 }, (_, i) => [`Person ${i}`, '', '']);
    const { rows, errors } = mapRows(data, mapping);
    expect(rows).toHaveLength(1000);
    expect(errors).toEqual([{ line: 1002, message: 'only the first 1000 rows are imported' }]);
  });
});

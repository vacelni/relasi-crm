/**
 * CSV import: an RFC 4180 parser (quoted fields, escaped quotes, CRLF, newlines inside quotes)
 * and the mapping from whatever headers a spreadsheet export has to contact fields.
 */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  // Excel adds a byte order mark; Indonesian-locale Excel uses ';' as the separator.
  const input = text.replace(/^﻿/, '');
  const firstLine = input.slice(0, input.search(/\r?\n|$/));
  const separator = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"' && field === '') {
      quoted = true;
    } else if (char === separator) {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Blank lines carry no data.
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

export const CONTACT_FIELDS = ['full_name', 'email', 'phone', 'title', 'company', 'notes'] as const;
export type ContactField = (typeof CONTACT_FIELDS)[number];
export type ImportRow = Partial<Record<ContactField, string>> & { full_name: string };

// Normalized header → field. English and Indonesian, plus common CRM export names.
const HEADER_ALIASES: Record<string, ContactField> = {
  name: 'full_name',
  fullname: 'full_name',
  contactname: 'full_name',
  nama: 'full_name',
  namalengkap: 'full_name',
  firstname: 'full_name',
  email: 'email',
  emailaddress: 'email',
  surel: 'email',
  phone: 'phone',
  phonenumber: 'phone',
  mobile: 'phone',
  whatsapp: 'phone',
  wa: 'phone',
  telepon: 'phone',
  nohp: 'phone',
  nomorhp: 'phone',
  hp: 'phone',
  title: 'title',
  jobtitle: 'title',
  position: 'title',
  jabatan: 'title',
  company: 'company',
  companyname: 'company',
  organization: 'company',
  perusahaan: 'company',
  instansi: 'company',
  notes: 'notes',
  note: 'notes',
  catatan: 'notes',
  keterangan: 'notes',
};

export function guessField(header: string): ContactField | null {
  const key = header.toLowerCase().replace(/[^a-z]/g, '');
  return HEADER_ALIASES[key] ?? null;
}

/** Column index → field, from the header row. A field maps to its first matching column. */
export function guessMapping(headers: string[]): (ContactField | null)[] {
  const used = new Set<ContactField>();
  return headers.map((header) => {
    const field = guessField(header);
    if (!field || used.has(field)) return null;
    used.add(field);
    return field;
  });
}

export type MappedRows = { rows: ImportRow[]; errors: { line: number; message: string }[] };

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE = /^\+?[0-9 ()-]{6,20}$/;
const MAX_ROWS = 1000;

/**
 * Applies a column mapping to the data rows (header excluded) and validates them the way the
 * database will, so problems show up in the preview instead of failing the whole import.
 * Line numbers are 1-based spreadsheet lines (the header is line 1).
 */
export function mapRows(data: string[][], mapping: (ContactField | null)[]): MappedRows {
  const rows: ImportRow[] = [];
  const errors: MappedRows['errors'] = [];
  const seenEmails = new Set<string>();

  data.slice(0, MAX_ROWS).forEach((cells, index) => {
    const line = index + 2;
    const record: Partial<Record<ContactField, string>> = {};
    mapping.forEach((field, column) => {
      const value = cells[column]?.trim();
      if (field && value) record[field] = value;
    });

    if (!record.full_name) return errors.push({ line, message: 'missing name' });
    if (record.full_name.length > 120) return errors.push({ line, message: 'name is longer than 120 characters' });
    if (record.email) {
      record.email = record.email.toLowerCase();
      if (!EMAIL.test(record.email)) return errors.push({ line, message: `invalid email "${record.email}"` });
      if (seenEmails.has(record.email)) return errors.push({ line, message: `duplicate email "${record.email}"` });
      seenEmails.add(record.email);
    }
    if (record.phone && !PHONE.test(record.phone)) {
      return errors.push({ line, message: `invalid phone "${record.phone}"` });
    }
    if (record.company && record.company.length > 120) record.company = record.company.slice(0, 120);
    if (record.title && record.title.length > 120) record.title = record.title.slice(0, 120);
    if (record.notes && record.notes.length > 4000) record.notes = record.notes.slice(0, 4000);
    rows.push(record as ImportRow);
  });

  if (data.length > MAX_ROWS) {
    errors.push({ line: MAX_ROWS + 2, message: `only the first ${MAX_ROWS} rows are imported` });
  }
  return { rows, errors };
}

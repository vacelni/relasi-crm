'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { Alert, Button, Card, CardHeader, inputClass } from '@/components/ui';
import { importContacts } from '@/features/contacts/actions';
import { CONTACT_FIELDS, guessMapping, mapRows, parseCsv, type ContactField } from '@/lib/csv';

const FIELD_LABELS: Record<ContactField, string> = {
  full_name: 'Name',
  email: 'Email',
  phone: 'Phone',
  title: 'Title',
  company: 'Company',
  notes: 'Notes',
};

const MAX_BYTES = 2 * 1024 * 1024;

export function Importer({ orgId }: { orgId: string }) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [table, setTable] = useState<string[][] | null>(null);
  const [mapping, setMapping] = useState<(ContactField | null)[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ inserted: number; skipped: number } | null>(null);
  const [pending, startTransition] = useTransition();

  const headers = table?.[0] ?? [];
  const mapped = useMemo(() => (table ? mapRows(table.slice(1), mapping) : null), [table, mapping]);
  const hasName = mapping.includes('full_name');

  async function onFile(file: File | undefined) {
    setError(null);
    setResult(null);
    if (!file) return;
    if (file.size > MAX_BYTES) return setError('The file is larger than 2 MB. Split it into smaller files.');
    const rows = parseCsv(await file.text());
    if (rows.length < 2) return setError('The file needs a header row and at least one contact.');
    setFileName(file.name);
    setTable(rows);
    setMapping(guessMapping(rows[0]!));
  }

  function submit() {
    if (!mapped?.rows.length) return;
    startTransition(async () => {
      const response = await importContacts(orgId, mapped.rows, 'import');
      if (!response.ok) return setError(response.error);
      setResult(response.data);
      setTable(null);
      setFileName(null);
    });
  }

  return (
    <div className="space-y-4">
      {error ? <Alert>{error}</Alert> : null}
      {result ? (
        <Alert tone="success">
          Imported {result.inserted} {result.inserted === 1 ? 'contact' : 'contacts'}
          {result.skipped ? `; skipped ${result.skipped} whose email is already in the CRM` : ''}.{' '}
          <Link href={`/o/${orgId}/contacts`} className="font-medium underline">
            View contacts
          </Link>
        </Alert>
      ) : null}

      <Card className="p-4">
        <label className="block text-sm font-medium" htmlFor="csv">
          CSV file
        </label>
        <input id="csv" type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} className="mt-2 block text-sm" />
        <p className="mt-2 text-xs text-muted">
          Up to 1000 rows. Headers in English or Indonesian are recognized (Nama, No HP, Perusahaan…). Comma or semicolon
          separated. Rows with an email that already exists are skipped.
        </p>
      </Card>

      {table && mapped ? (
        <Card>
          <CardHeader title={`Map columns: ${fileName}`} description="Check which column goes to which field." />
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {headers.map((header, column) => (
              <label key={column} className="block text-sm">
                <span className="block truncate font-medium" title={header}>
                  {header || `Column ${column + 1}`}
                </span>
                <select
                  value={mapping[column] ?? ''}
                  onChange={(e) => {
                    const field = (e.target.value || null) as ContactField | null;
                    // A field can come from one column only.
                    setMapping(mapping.map((m, i) => (i === column ? field : m === field ? null : m)));
                  }}
                  className={`${inputClass} mt-1`}
                >
                  <option value="">Skip this column</option>
                  {CONTACT_FIELDS.map((f) => (
                    <option key={f} value={f}>
                      {FIELD_LABELS[f]}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <div className="border-t border-border p-4">
            {!hasName ? <Alert tone="warning">Choose which column holds the name.</Alert> : null}
            {hasName ? (
              <>
                <p className="text-sm">
                  <span className="font-medium">{mapped.rows.length}</span> ready to import
                  {mapped.errors.length ? (
                    <>
                      , <span className="font-medium text-danger">{mapped.errors.length}</span> with problems (not imported)
                    </>
                  ) : null}
                  .
                </p>
                {mapped.errors.length ? (
                  <ul className="mt-2 max-h-40 overflow-y-auto rounded-control bg-danger-soft px-3 py-2 text-xs text-danger-ink">
                    {mapped.errors.slice(0, 50).map((e) => (
                      <li key={`${e.line}-${e.message}`}>
                        Line {e.line}: {e.message}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-xs">
                    <caption className="sr-only">First rows to import</caption>
                    <thead className="text-left text-muted">
                      <tr>
                        {CONTACT_FIELDS.filter((f) => mapping.includes(f)).map((f) => (
                          <th key={f} className="px-2 py-1 font-medium">
                            {FIELD_LABELS[f]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {mapped.rows.slice(0, 5).map((row, i) => (
                        <tr key={i}>
                          {CONTACT_FIELDS.filter((f) => mapping.includes(f)).map((f) => (
                            <td key={f} className="max-w-48 truncate px-2 py-1">
                              {row[f] ?? ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Button type="button" className="mt-4" onClick={submit} disabled={pending || mapped.rows.length === 0}>
                  {pending ? 'Importing…' : `Import ${mapped.rows.length} ${mapped.rows.length === 1 ? 'contact' : 'contacts'}`}
                </Button>
              </>
            ) : null}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { AiSourceNote } from '@/components/AiSourceNote';
import { Alert, Button, inputClass } from '@/components/ui';
import { importContacts } from '@/features/contacts/actions';
import { extractContacts } from '@/features/ai/actions';
import type { ExtractedContact } from '@/lib/ai/schemas';
import type { AiSource } from '@/lib/ai/types';
import { MAX_EXTRACT_CHARS } from '@/lib/ai/prompts';

const EXAMPLE = `Dewi Anggraini - Owner, Toko Roti Melati
dewi@melati.example.com | WA 0812-3456-7890
Wants a pre-order page for Lebaran hampers.

Bayu Saputra
Marketing manager
PT Sumber Rejeki Abadi
+62 813 2222 1111`;

/** Paste a business card, signature, or chat → review the extracted people → save them. */
export function ExtractContacts({ orgId }: { orgId: string }) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<{ contacts: ExtractedContact[]; source: AiSource; remaining: number | null } | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function extract() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const response = await extractContacts(orgId, text);
      if (!response.ok) return setError(response.error);
      setResult(response.data);
      setSelected(new Set(response.data.contacts.map((_, i) => i)));
      if (response.data.contacts.length === 0) setError('No people with a name were found in that text.');
    });
  }

  function save() {
    if (!result) return;
    const rows = result.contacts
      .filter((_, i) => selected.has(i))
      .map((c) => Object.fromEntries(Object.entries(c).filter(([, v]) => v != null && v !== '')) as { full_name: string });
    startTransition(async () => {
      const response = await importContacts(orgId, rows, 'ai_extract');
      if (!response.ok) return setError(response.error);
      const { inserted, skipped } = response.data;
      setMessage(`${inserted} saved${skipped ? `, ${skipped} skipped (email already in the CRM)` : ''}.`);
      setResult(null);
      setText('');
    });
  }

  return (
    <details className="rounded-card border border-ai-border bg-surface self-start">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-primary">Paste text to extract contacts</summary>
      <div className="space-y-3 border-t border-ai-border p-4">
        <p className="text-xs text-muted">Business cards, email signatures, WhatsApp chats, sign-up lists. Nothing is saved until you confirm.</p>
        <textarea
          aria-label="Text to extract contacts from"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          maxLength={MAX_EXTRACT_CHARS}
          placeholder={EXAMPLE}
          className={inputClass}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="ai" size="sm" onClick={extract} disabled={pending || !text.trim()}>
            {pending && !result ? 'Extracting…' : 'Extract contacts'}
          </Button>
          {!text ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setText(EXAMPLE)}>
              Use an example
            </Button>
          ) : null}
          <span className="ml-auto text-xs text-muted">
            {text.length.toLocaleString('en')}/{MAX_EXTRACT_CHARS.toLocaleString('en')}
          </span>
        </div>
        {error ? <Alert>{error}</Alert> : null}
        {message ? <Alert tone="success">{message}</Alert> : null}

        {result && result.contacts.length > 0 ? (
          <div className="space-y-2">
            <ul className="divide-y divide-border rounded-control border border-border">
              {result.contacts.map((c, i) => (
                <li key={i}>
                  <label className="flex gap-3 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selected.has(i)}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(i);
                        else next.delete(i);
                        setSelected(next);
                      }}
                    />
                    <span className="min-w-0">
                      <span className="block font-medium">{c.full_name}</span>
                      <span className="block text-xs text-muted">
                        {[c.title, c.company, c.email, c.phone].filter(Boolean).join(' · ') || 'No details'}
                      </span>
                      {c.notes ? <span className="block text-xs text-muted italic">{c.notes}</span> : null}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <AiSourceNote source={result.source} remaining={result.remaining} />
            <Button type="button" size="sm" onClick={save} disabled={pending || selected.size === 0}>
              {pending ? 'Saving…' : `Save ${selected.size} ${selected.size === 1 ? 'contact' : 'contacts'}`}
            </Button>
          </div>
        ) : null}
      </div>
    </details>
  );
}

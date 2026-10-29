'use client';

import { useActionState } from 'react';
import { FormMessage, initialFormState, SubmitButton } from '@/components/forms';
import { Field, inputClass } from '@/components/ui';
import { createContact } from '@/features/contacts/actions';

export function NewContactForm({ orgId, companies }: { orgId: string; companies: { id: string; name: string }[] }) {
  const [state, action] = useActionState(createContact.bind(null, orgId), initialFormState);
  return (
    <details className="group rounded-card border border-border bg-surface self-start" open={Boolean(state.error || state.fields)}>
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-primary">+ New contact</summary>
      <form action={action} className="grid gap-3 border-t border-border p-4 sm:grid-cols-2" noValidate>
        <div className="sm:col-span-2">
          <FormMessage state={state} />
        </div>
        <Field label="Name" name="full_name" error={state.fields?.full_name}>
          <input id="full_name" name="full_name" required maxLength={120} className={inputClass} />
        </Field>
        <Field label="Title" name="title" error={state.fields?.title}>
          <input id="title" name="title" maxLength={120} placeholder="Owner" className={inputClass} />
        </Field>
        <Field label="Email" name="email" error={state.fields?.email}>
          <input id="email" name="email" type="email" className={inputClass} />
        </Field>
        <Field label="Phone / WhatsApp" name="phone" error={state.fields?.phone}>
          <input id="phone" name="phone" inputMode="tel" placeholder="0812-…" className={inputClass} />
        </Field>
        <Field label="Company" name="company_id">
          <select id="company_id" name="company_id" defaultValue="" className={inputClass}>
            <option value="">None</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status" name="status">
            <select id="status" name="status" defaultValue="lead" className={inputClass}>
              <option value="lead">Lead</option>
              <option value="qualified">Qualified</option>
              <option value="customer">Customer</option>
              <option value="churned">Churned</option>
            </select>
          </Field>
          <Field label="Source" name="source">
            <select id="source" name="source" defaultValue="manual" className={inputClass}>
              <option value="manual">Manual</option>
              <option value="referral">Referral</option>
              <option value="website">Website</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="other">Other</option>
            </select>
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Notes" name="notes" error={state.fields?.notes}>
            <textarea id="notes" name="notes" rows={3} maxLength={4000} className={inputClass} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <SubmitButton pendingText="Adding…">Add contact</SubmitButton>
        </div>
      </form>
    </details>
  );
}

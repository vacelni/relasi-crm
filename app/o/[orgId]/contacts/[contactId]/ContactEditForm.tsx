'use client';

import { useActionState } from 'react';
import { FormMessage, initialFormState, SubmitButton } from '@/components/forms';
import { Field, inputClass } from '@/components/ui';
import { updateContact } from '@/features/contacts/actions';

type ContactFields = {
  full_name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  company_id: string | null;
  status: string;
  notes: string | null;
};

export function ContactEditForm({
  orgId,
  contactId,
  contact,
  companies,
  editable,
}: {
  orgId: string;
  contactId: string;
  contact: ContactFields;
  companies: { id: string; name: string }[];
  editable: boolean;
}) {
  const [state, action] = useActionState(updateContact.bind(null, orgId, contactId), initialFormState);
  return (
    <form action={action} className="space-y-3" noValidate>
      <FormMessage state={state} />
      <fieldset disabled={!editable} className="space-y-3">
        <Field label="Name" name="full_name" error={state.fields?.full_name}>
          <input id="full_name" name="full_name" defaultValue={contact.full_name} required maxLength={120} className={inputClass} />
        </Field>
        <Field label="Title" name="title" error={state.fields?.title}>
          <input id="title" name="title" defaultValue={contact.title ?? ''} maxLength={120} className={inputClass} />
        </Field>
        <Field label="Email" name="email" error={state.fields?.email}>
          <input id="email" name="email" type="email" defaultValue={contact.email ?? ''} className={inputClass} />
        </Field>
        <Field label="Phone / WhatsApp" name="phone" error={state.fields?.phone}>
          <input id="phone" name="phone" inputMode="tel" defaultValue={contact.phone ?? ''} className={inputClass} />
        </Field>
        <Field label="Company" name="company_id">
          <select id="company_id" name="company_id" defaultValue={contact.company_id ?? ''} className={inputClass}>
            <option value="">None</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status" name="status">
          <select id="status" name="status" defaultValue={contact.status} className={inputClass}>
            <option value="lead">Lead</option>
            <option value="qualified">Qualified</option>
            <option value="customer">Customer</option>
            <option value="churned">Churned</option>
          </select>
        </Field>
        <Field label="Notes" name="notes" error={state.fields?.notes}>
          <textarea id="notes" name="notes" rows={4} defaultValue={contact.notes ?? ''} maxLength={4000} className={inputClass} />
        </Field>
        {editable ? <SubmitButton size="sm">Save changes</SubmitButton> : null}
      </fieldset>
    </form>
  );
}

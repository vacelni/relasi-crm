'use client';

import { useActionState, useEffect, useRef } from 'react';
import { FormMessage, initialFormState, SubmitButton } from '@/components/forms';
import { Field, inputClass } from '@/components/ui';
import { createCompany } from '@/features/contacts/actions';

export function NewCompanyForm({ orgId }: { orgId: string }) {
  const [state, action] = useActionState(createCompany.bind(null, orgId), initialFormState);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);
  return (
    <form ref={formRef} action={action} className="mb-4 grid gap-3 rounded-card border border-border bg-surface p-4 sm:grid-cols-4" noValidate>
      <div className="sm:col-span-4">
        <FormMessage state={state} />
      </div>
      <Field label="Company name" name="name" error={state.fields?.name}>
        <input id="name" name="name" required maxLength={120} className={inputClass} />
      </Field>
      <Field label="Website" name="domain" error={state.fields?.domain}>
        <input id="domain" name="domain" maxLength={120} placeholder="example.com" className={inputClass} />
      </Field>
      <Field label="Industry" name="industry" error={state.fields?.industry}>
        <input id="industry" name="industry" maxLength={80} placeholder="Food & beverage" className={inputClass} />
      </Field>
      <div className="flex items-end">
        <SubmitButton pendingText="Adding…">Add company</SubmitButton>
      </div>
    </form>
  );
}

'use client';

import { useActionState } from 'react';
import { FormMessage, initialFormState, SubmitButton } from '@/components/forms';
import { Field, inputClass } from '@/components/ui';
import { createOrganization } from '@/features/orgs/actions';

export function CreateOrgForm() {
  const [state, action] = useActionState(createOrganization, initialFormState);
  return (
    <form action={action} className="mt-4 space-y-4" noValidate>
      <FormMessage state={state} />
      <Field label="Business or team name" name="name" error={state.fields?.name}>
        <input id="name" name="name" required maxLength={80} placeholder="e.g. Sinar Digital Agency" className={inputClass} />
      </Field>
      <SubmitButton className="w-full" pendingText="Creating…">
        Create workspace
      </SubmitButton>
    </form>
  );
}

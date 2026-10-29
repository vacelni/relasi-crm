'use client';

import { useActionState, useEffect, useRef } from 'react';
import { FormMessage, initialFormState, SubmitButton } from '@/components/forms';
import { Field, inputClass } from '@/components/ui';
import { inviteMember, renameOrganization } from '@/features/orgs/actions';

export function InviteForm({ orgId }: { orgId: string }) {
  const [state, action] = useActionState(inviteMember.bind(null, orgId), initialFormState);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);
  return (
    <form ref={formRef} action={action} className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end" noValidate>
      <div className="sm:col-span-3">
        <FormMessage state={state} />
      </div>
      <Field label="Email" name="email" error={state.fields?.email}>
        <input id="email" name="email" type="email" required className={inputClass} />
      </Field>
      <Field label="Role" name="role">
        <select id="role" name="role" defaultValue="sales" className={inputClass}>
          <option value="sales">Sales</option>
          <option value="admin">Admin</option>
        </select>
      </Field>
      <SubmitButton pendingText="Creating…">Create invite</SubmitButton>
    </form>
  );
}

export function RenameForm({ orgId, name }: { orgId: string; name: string }) {
  const [state, action] = useActionState(renameOrganization.bind(null, orgId), initialFormState);
  return (
    <form action={action} className="space-y-3" noValidate>
      <FormMessage state={state} />
      <Field label="Name" name="name" error={state.fields?.name}>
        <input id="name" name="name" defaultValue={name} required maxLength={80} className={inputClass} />
      </Field>
      <SubmitButton size="sm">Save</SubmitButton>
    </form>
  );
}

'use client';

import { useActionState, useEffect, useRef } from 'react';
import { FormMessage, initialFormState, SubmitButton } from '@/components/forms';
import { Field, inputClass } from '@/components/ui';
import { createDeal } from '@/features/deals/actions';
import type { BoardStage } from './Board';

export function NewDealForm({
  orgId,
  stages,
  contacts,
  contactId,
}: {
  orgId: string;
  stages: BoardStage[];
  contacts: { id: string; full_name: string }[];
  /** Fixed contact (on a contact page). */
  contactId?: string;
}) {
  const [state, action] = useActionState(createDeal.bind(null, orgId), initialFormState);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);
  const openStages = stages.filter((s) => s.kind === 'open');

  return (
    <details className="group mb-4 rounded-card border border-border bg-surface" open={Boolean(state.error || state.fields)}>
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-primary marker:hidden">
        <span className="group-open:hidden">+ New deal</span>
        <span className="hidden group-open:inline">New deal</span>
      </summary>
      <form ref={formRef} action={action} className="grid gap-3 border-t border-border p-4 sm:grid-cols-2 lg:grid-cols-5" noValidate>
        <div className="sm:col-span-2 lg:col-span-5">
          <FormMessage state={state} />
        </div>
        <Field label="Title" name="title" error={state.fields?.title}>
          <input id="title" name="title" required maxLength={160} placeholder="Website redesign" className={inputClass} />
        </Field>
        <Field label="Value (Rp)" name="value" error={state.fields?.value}>
          <input id="value" name="value" inputMode="numeric" placeholder="15.000.000" className={inputClass} />
        </Field>
        <Field label="Stage" name="stage_id" error={state.fields?.stage_id}>
          <select id="stage_id" name="stage_id" className={inputClass} defaultValue={openStages[0]?.id}>
            {openStages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        {contactId ? (
          <input type="hidden" name="contact_id" value={contactId} />
        ) : (
          <Field label="Contact" name="contact_id" error={state.fields?.contact_id}>
            <select id="contact_id" name="contact_id" className={inputClass} defaultValue="">
              <option value="">None</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Expected close" name="expected_close" error={state.fields?.expected_close}>
          <input id="expected_close" name="expected_close" type="date" className={inputClass} />
        </Field>
        <div className="sm:col-span-2 lg:col-span-5">
          <SubmitButton pendingText="Adding…">Add deal</SubmitButton>
        </div>
      </form>
    </details>
  );
}

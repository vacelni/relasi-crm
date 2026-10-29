'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { FormMessage, initialFormState, SubmitButton } from '@/components/forms';
import { Field, inputClass } from '@/components/ui';
import { logActivity } from '@/features/activities/actions';

const KINDS = [
  { value: 'note', label: 'Note' },
  { value: 'call', label: 'Call' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'task', label: 'Task / reminder' },
];

export function ActivityForm({ orgId, contactId, deals }: { orgId: string; contactId: string; deals: { id: string; title: string }[] }) {
  const [state, action] = useActionState(logActivity.bind(null, orgId, contactId), initialFormState);
  const [kind, setKind] = useState('note');
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} onReset={() => setKind('note')} className="space-y-3" noValidate>
      <FormMessage state={state} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Type" name="kind">
          <select id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className={inputClass}>
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label={kind === 'task' ? 'What needs doing' : 'Subject'} name="subject" error={state.fields?.subject}>
            <input id="subject" name="subject" required maxLength={200} className={inputClass} />
          </Field>
        </div>
      </div>
      {kind === 'task' ? (
        <Field label="Due (WIB)" name="due_at" error={state.fields?.due_at}>
          <input id="due_at" name="due_at" type="datetime-local" required className={inputClass} />
        </Field>
      ) : (
        <Field label="What happened" name="body" error={state.fields?.body} hint="The AI summary and lead score read these notes.">
          <textarea id="body" name="body" rows={3} maxLength={4000} className={inputClass} />
        </Field>
      )}
      {deals.length > 0 ? (
        <Field label="Related deal" name="deal_id">
          <select id="deal_id" name="deal_id" defaultValue="" className={inputClass}>
            <option value="">None</option>
            {deals.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      <SubmitButton size="sm">{kind === 'task' ? 'Add task' : 'Log it'}</SubmitButton>
    </form>
  );
}

'use client';

import { useActionState } from 'react';
import { FormMessage, initialFormState, SubmitButton } from '@/components/forms';
import { Field, inputClass } from '@/components/ui';
import { signUp } from '@/features/auth/actions';

export function SignupForm({ next }: { next: string }) {
  const [state, action] = useActionState(signUp, initialFormState);
  if (state.ok) {
    return (
      <div className="mt-4">
        <FormMessage state={state} />
      </div>
    );
  }
  return (
    <form action={action} className="mt-4 space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <FormMessage state={state} />
      <Field label="Your name" name="full_name" error={state.fields?.full_name}>
        <input id="full_name" name="full_name" autoComplete="name" required maxLength={80} className={inputClass} />
      </Field>
      <Field label="Work email" name="email" error={state.fields?.email}>
        <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
      </Field>
      <Field label="Password" name="password" error={state.fields?.password} hint="At least 8 characters.">
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} className={inputClass} />
      </Field>
      <SubmitButton className="w-full" pendingText="Creating account…">
        Create account
      </SubmitButton>
    </form>
  );
}

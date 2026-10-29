'use client';

import { useActionState } from 'react';
import { FormMessage, initialFormState, SubmitButton } from '@/components/forms';
import { acceptInvitation } from '@/features/orgs/actions';

export function AcceptForm({ token }: { token: string }) {
  const [state, action] = useActionState(acceptInvitation, initialFormState);
  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      <SubmitButton className="w-full" pendingText="Joining…">
        Join workspace
      </SubmitButton>
    </form>
  );
}

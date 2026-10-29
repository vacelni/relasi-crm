'use client';

import { useFormStatus } from 'react-dom';
import type { ComponentProps } from 'react';
import { Alert, buttonClass, cx } from './ui';

/** Form state returned by every form Server Action. */
export type FormState = {
  ok?: boolean;
  error?: string;
  message?: string;
  fields?: Record<string, string>;
};

export const initialFormState: FormState = {};

export function SubmitButton({
  children,
  pendingText,
  variant = 'primary',
  size,
  className,
  ...props
}: ComponentProps<'button'> & { pendingText?: string; variant?: Parameters<typeof buttonClass>[0]; size?: 'sm' | 'md' }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={cx(buttonClass(variant, size), className)} {...props}>
      {pending ? (pendingText ?? 'Saving…') : children}
    </button>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (state.error) return <Alert>{state.error}</Alert>;
  if (state.message) return <Alert tone="success">{state.message}</Alert>;
  return null;
}

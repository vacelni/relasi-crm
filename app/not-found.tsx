import { ButtonLink } from '@/components/ui';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-sm font-medium text-primary">404</p>
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p className="max-w-sm text-sm text-muted">This page does not exist, or it belongs to a workspace you are not a member of.</p>
      <ButtonLink href="/o" variant="secondary">
        Go to my workspace
      </ButtonLink>
    </main>
  );
}

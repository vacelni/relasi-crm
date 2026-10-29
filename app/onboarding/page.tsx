import type { Metadata } from 'next';
import Link from 'next/link';
import { Card } from '@/components/ui';
import { Logo } from '@/components/Logo';
import { requireUser } from '@/lib/org';
import { CreateOrgForm } from './CreateOrgForm';

export const metadata: Metadata = { title: 'Create a workspace' };

export default async function OnboardingPage() {
  const { user } = await requireUser();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Logo />
      <Card className="mt-6 w-full max-w-md p-6">
        <h1 className="text-xl font-semibold">Create your workspace</h1>
        <p className="mt-1 text-sm text-muted">
          A workspace holds your team&apos;s contacts, deals, and pipeline. You can invite teammates next.
        </p>
        <CreateOrgForm />
        <p className="mt-4 text-xs text-muted">
          Signed in as {user.email}. Invited to an existing workspace? Open the invitation link you received instead.{' '}
          <Link href="/o" className="text-primary hover:underline">
            My workspaces
          </Link>
        </p>
      </Card>
    </main>
  );
}

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui';
import { Logo } from '@/components/Logo';
import { createClient } from '@/lib/supabase/server';
import { AcceptForm } from './AcceptForm';

export const metadata: Metadata = { title: 'Join a workspace' };

/**
 * Invitation links. The invitee cannot read the invitation (only admins can), so this page
 * shows who is signed in and lets accept_invitation() decide; it checks the email match.
 */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(`/signup?next=${encodeURIComponent(`/invite/${token}`)}`);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Logo />
      <Card className="mt-6 w-full max-w-md p-6">
        <h1 className="text-xl font-semibold">You&apos;ve been invited</h1>
        <p className="mt-1 text-sm text-muted">
          Join the workspace as <span className="font-medium text-foreground">{data.user.email}</span>. The invitation must have
          been sent to this email address.
        </p>
        <AcceptForm token={token} />
      </Card>
    </main>
  );
}

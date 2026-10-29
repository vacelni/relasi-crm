import type { Metadata } from 'next';
import Link from 'next/link';
import { Card } from '@/components/ui';
import { SignupForm } from './SignupForm';

export const metadata: Metadata = { title: 'Create an account' };

export default async function SignupPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { next } = await searchParams;
  return (
    <Card className="p-6">
      <h1 className="text-xl font-semibold">Create your account</h1>
      <p className="mt-1 text-sm text-muted">Free for up to 3 people. No card needed.</p>
      <SignupForm next={next ?? ''} />
      <p className="mt-4 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'} className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </Card>
  );
}

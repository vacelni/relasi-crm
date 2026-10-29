import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, Card } from '@/components/ui';
import { signInDemo } from '@/features/auth/actions';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const demoEnabled = process.env.NEXT_PUBLIC_DEMO_ENABLED === 'true';

  return (
    <div className="space-y-4">
      {params.confirm === 'failed' ? <Alert>That confirmation link is invalid or expired. Sign in, or sign up again.</Alert> : null}
      {params.demo === 'unavailable' ? <Alert>The demo is being reset. Try again in a minute.</Alert> : null}

      {demoEnabled ? (
        <Card className="border-primary-border bg-primary-soft p-4">
          <h2 className="text-sm font-semibold text-primary-ink">Try the demo workspace</h2>
          <p className="mt-1 text-xs text-primary-ink/80">
            A sample agency with contacts, deals, and tasks. Sign in as the owner, or as a sales rep to see what RLS lets them
            change. Data resets every hour.
          </p>
          <form action={signInDemo} className="mt-3 grid grid-cols-2 gap-2">
            <button name="role" value="owner" className="h-9 rounded-control bg-primary text-sm font-medium text-white hover:bg-primary-hover">
              Demo as owner
            </button>
            <button
              name="role"
              value="sales"
              className="h-9 rounded-control border border-primary/40 bg-surface text-sm font-medium text-primary-ink hover:bg-white/60"
            >
              Demo as sales
            </button>
          </form>
        </Card>
      ) : null}

      <Card className="p-6">
        <h1 className="text-xl font-semibold">Sign in</h1>
        <LoginForm next={params.next ?? ''} />
        <p className="mt-4 text-center text-sm text-muted">
          New to Relasi?{' '}
          <Link href={params.next ? `/signup?next=${encodeURIComponent(params.next)}` : '/signup'} className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </Card>
    </div>
  );
}

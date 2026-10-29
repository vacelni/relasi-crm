import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { buttonClass } from '@/components/ui';
import { signInDemo } from '@/features/auth/actions';

const features = [
  {
    title: 'Pipeline you can drag',
    body: 'A Kanban board per workspace with stage probabilities, so the dashboard shows weighted pipeline and win rate, not just a list.',
  },
  {
    title: 'AI that reads the history',
    body: 'Claude summarizes every interaction with a contact, scores the lead with reasons you can check, and drafts the WhatsApp or email follow-up.',
  },
  {
    title: 'Paste, don’t type',
    body: 'Paste a business card, an email signature, or a WhatsApp chat and get structured contacts. Or import a spreadsheet export.',
  },
  {
    title: 'Built for a team',
    body: 'Owner, admin, and sales roles enforced in Postgres row-level security, invitations, an audit log, and per-workspace AI quotas.',
  },
];

export default function Home() {
  const demoEnabled = process.env.NEXT_PUBLIC_DEMO_ENABLED === 'true';
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <Logo />
        <nav className="flex items-center gap-2">
          <Link href="/login" className={buttonClass('ghost', 'sm')}>
            Sign in
          </Link>
          <Link href="/signup" className={buttonClass('primary', 'sm')}>
            Get started
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4">
        <section className="py-16 sm:py-24">
          <p className="text-sm font-medium text-primary">CRM for UMKM and small agencies</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Know every customer relationship, and what to say next.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted">
            Relasi keeps your contacts, deals, and follow-ups in one place, then uses AI to summarize each relationship, score
            leads, and draft the next message in Bahasa Indonesia or English.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {demoEnabled ? (
              <form action={signInDemo}>
                <button name="role" value="owner" className={buttonClass('primary')}>
                  Open the live demo
                </button>
              </form>
            ) : null}
            <Link href="/signup" className={buttonClass('secondary')}>
              Create a free workspace
            </Link>
          </div>
        </section>

        <section className="grid gap-4 pb-20 sm:grid-cols-2">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-card border border-border bg-surface p-5">
              <h2 className="font-semibold">{feature.title}</h2>
              <p className="mt-2 text-sm text-muted">{feature.body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted">
        Relasi is an open-source portfolio project by{' '}
        <a href="https://github.com/vacelni" className="text-primary hover:underline">
          Vacelnino Faiz Fadeli
        </a>
        . Payments run in Midtrans sandbox mode.
      </footer>
    </div>
  );
}

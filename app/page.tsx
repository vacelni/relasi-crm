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

const steps = [
  { title: 'Bring your contacts', body: 'Import the spreadsheet you already keep, or paste a WhatsApp chat.' },
  { title: 'Log what happens', body: 'Calls, meetings, and chats go on the contact. Deals move across the board.' },
  { title: 'Ask what to do next', body: 'Get a summary, a lead score with evidence, and a message ready to send.' },
];

export default function Home() {
  const demoEnabled = process.env.NEXT_PUBLIC_DEMO_ENABLED === 'true';
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
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

      <main className="mx-auto max-w-6xl px-4">
        <section className="grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="text-sm font-medium text-primary">CRM for UMKM and small agencies</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              Know every customer relationship, and what to say next.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">
              Relasi keeps your contacts, deals, and follow-ups in one place, then uses AI to summarize each relationship,
              score leads, and draft the next message in Bahasa Indonesia or English.
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
            {demoEnabled ? <p className="mt-3 text-xs text-muted">No sign-up: the demo opens a shared workspace that resets every hour.</p> : null}
          </div>

          <ProductPreview />
        </section>

        <section aria-labelledby="how" className="border-y border-border py-12">
          <h2 id="how" className="text-sm font-semibold text-muted">
            How it works
          </h2>
          <ol className="mt-6 grid gap-8 sm:grid-cols-3">
            {steps.map((step, i) => (
              <li key={step.title}>
                <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">{i + 1}</span>
                <h3 className="mt-3 font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="grid gap-4 py-16 sm:grid-cols-2">
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

/** A static picture of the contact page's AI panel, drawn in markup so it stays sharp and needs no screenshot. */
function ProductPreview() {
  return (
    <figure aria-label="Example: the AI assistant on a contact" className="relative">
      <div aria-hidden="true" className="absolute -inset-4 -z-10 rounded-[1.5rem] bg-primary-soft" />
      <div className="rounded-card border border-border bg-surface p-5 shadow-lg shadow-primary/5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold">Dewi Lestari</p>
            <p className="text-sm text-muted">Owner · Kopi Senja Nusantara</p>
          </div>
          <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary-ink">Qualified</span>
        </div>

        <div className="mt-4 rounded-control border border-ai-border bg-ai-soft p-3">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-semibold text-ai">Lead score</p>
            <p className="text-2xl font-bold tabular-nums text-ai">
              78<span className="text-sm font-medium">/100</span>
            </p>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-surface">
            <div className="h-1.5 w-[78%] rounded-full bg-ai" />
          </div>
          <ul className="mt-3 space-y-1 text-xs text-foreground">
            <li>+ Asked for a revised proposal two days ago</li>
            <li>+ Open deal of Rp45jt in Negotiation</li>
            <li>− No reply to the last WhatsApp yet</li>
          </ul>
        </div>

        <div className="mt-3 rounded-control border border-border p-3">
          <p className="text-xs font-semibold text-muted">Follow-up draft · WhatsApp</p>
          <p className="mt-1.5 text-sm">
            Halo Bu Dewi, ini proposal revisi untuk program loyalty Kopi Senja dengan opsi Rp45jt. Apakah Kamis siang bisa
            kita bahas 15 menit?
          </p>
          <p className="mt-2 text-xs font-medium text-primary">Open in WhatsApp →</p>
        </div>
      </div>
    </figure>
  );
}

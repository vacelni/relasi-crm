import Link from 'next/link';
import { HeatMeter } from '@/components/HeatMeter';
import { Logo } from '@/components/Logo';
import { buttonClass } from '@/components/ui';
import { signInDemo } from '@/features/auth/actions';

const features = [
  {
    title: 'A pipeline you can drag',
    body: 'A board per workspace with stage probabilities, so the dashboard shows weighted pipeline and win rate, not just a list.',
  },
  {
    title: 'Notes that turn into next steps',
    body: 'Every call, meeting, and chat on a contact feeds a summary, a lead score with the evidence behind it, and a follow-up draft.',
  },
  {
    title: 'Paste instead of typing',
    body: 'Paste a business card, an email signature, or a WhatsApp chat to get structured contacts, or import a spreadsheet export.',
  },
  {
    title: 'Roles that hold',
    body: 'Owner, admin, and sales roles are enforced by Postgres row-level security, with invitations, an audit log, and per-workspace AI quotas.',
  },
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
        <section className="grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1fr_1fr]">
          <div>
            <h1 className="text-4xl leading-[1.05] font-bold tracking-tight text-balance sm:text-6xl">
              Know every customer, and what to say next.
            </h1>
            <p className="mt-6 max-w-lg text-lg text-muted">
              A CRM for UMKM and small agencies that sell over WhatsApp. Relasi keeps contacts, deals, and follow-ups in one
              place, then summarizes each relationship, scores the lead, and drafts the next message in Bahasa Indonesia or
              English.
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

        <section aria-label="Features" className="grid gap-x-10 gap-y-8 border-t border-border py-14 sm:grid-cols-2">
          {features.map((feature) => (
            <div key={feature.title} className="max-w-md">
              <h2 className="font-semibold">{feature.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{feature.body}</p>
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

const history = [
  { when: '18 days ago', kind: 'Call', text: 'Misses ~30% of bookings that come in by phone after hours.' },
  { when: '5 days ago', kind: 'Meeting', text: 'Partners liked the prototype. Budget Rp30-35jt approved.' },
];

const reasons = ['Status is qualified (+30)', 'Open deal at 50% stage probability (+15)', 'Budget is approved (+15)', 'Has a timeline (+8)'];

/**
 * A static picture of one contact from the live demo, drawn in markup so it stays sharp. The score, reasons, and
 * draft are what the rule-based engine returns for this contact, so the picture matches what a visitor will see.
 */
function ProductPreview() {
  return (
    <figure aria-label="Example: a contact in the demo workspace" className="rounded-card border border-border bg-surface shadow-[0_1px_2px_rgb(24_35_59/0.06),0_12px_32px_-12px_rgb(24_35_59/0.18)]">
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <p className="font-semibold">dr. Maya Putri</p>
          <p className="text-sm text-muted">Clinic director at Klinik Gigi Ceria</p>
        </div>
        <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary-ink">Qualified</span>
      </div>

      <ol className="space-y-2 border-b border-border px-5 py-4 text-sm">
        {history.map((item) => (
          <li key={item.when} className="grid grid-cols-[5.5rem_1fr] gap-3">
            <span className="text-xs leading-5 text-muted">{item.when}</span>
            <span>
              <span className="font-medium">{item.kind}.</span> {item.text}
            </span>
          </li>
        ))}
      </ol>

      <div className="border-b border-border px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">Lead score</p>
          <HeatMeter score={80} size="lg" />
        </div>
        <ul className="mt-2 grid gap-x-4 gap-y-0.5 text-xs text-muted sm:grid-cols-2">
          {reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </div>

      <div className="px-5 py-4">
        <p className="text-sm font-semibold">Follow-up draft</p>
        <p className="mt-2 ml-auto max-w-sm rounded-2xl rounded-br-sm border border-primary-border bg-primary-soft px-3.5 py-2.5 text-sm leading-relaxed">
          Halo Maya, semoga sehat selalu. Saya ingin menindaklanjuti soal &ldquo;Demo of booking prototype&rdquo;. Apakah ada
          waktu minggu ini untuk ngobrol sebentar? Terima kasih.
        </p>
        <figcaption className="mt-3 text-xs text-muted">From the demo workspace, scored and drafted in rule-based mode.</figcaption>
      </div>
    </figure>
  );
}

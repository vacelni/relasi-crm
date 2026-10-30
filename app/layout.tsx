import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

// Plus Jakarta Sans was drawn for Jakarta's city branding: an Indonesian typeface for an Indonesian product.
// next/font self-hosts it, so the CSP keeps font-src 'self'.
const sans = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Relasi: AI-powered CRM for small businesses', template: '%s · Relasi' },
  description:
    'A multi-tenant CRM for small Indonesian businesses and agencies: contacts, a drag-and-drop pipeline, tasks, and AI summaries, lead scores, and follow-up drafts.',
  applicationName: 'Relasi',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#2c3e91',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sans.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}

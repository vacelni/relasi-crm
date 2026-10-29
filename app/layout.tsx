import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Relasi: AI-powered CRM for small businesses', template: '%s · Relasi' },
  description:
    'A multi-tenant CRM for small Indonesian businesses and agencies: contacts, a drag-and-drop pipeline, tasks, and AI summaries, lead scores, and follow-up drafts.',
  applicationName: 'Relasi',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f766e',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

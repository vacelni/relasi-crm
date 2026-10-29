import 'server-only';
import { headers } from 'next/headers';

/** This deployment's origin, for links that leave the app (invitations, email and payment callbacks). */
export async function siteOrigin(): Promise<string> {
  // Pinned in production so a forged Host header cannot shape the links.
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '');
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https');
  return `${proto}://${host}`;
}

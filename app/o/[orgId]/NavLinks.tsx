'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cx } from '@/components/ui';

const links = [
  { href: '', label: 'Dashboard' },
  { href: '/pipeline', label: 'Pipeline' },
  { href: '/contacts', label: 'Contacts' },
  { href: '/companies', label: 'Companies' },
  { href: '/tasks', label: 'Tasks' },
  { href: '/import', label: 'Import' },
  { href: '/settings', label: 'Settings' },
];

export function NavLinks({ orgId }: { orgId: string }) {
  const pathname = usePathname();
  const base = `/o/${orgId}`;
  return (
    <nav aria-label="Workspace" className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-col lg:overflow-visible lg:px-3">
      {links.map((link) => {
        const href = `${base}${link.href}`;
        const active = link.href === '' ? pathname === base : pathname.startsWith(href);
        return (
          <Link
            key={link.href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cx(
              'shrink-0 rounded-control px-3 py-2 text-sm font-medium transition-colors',
              active ? 'bg-primary-soft text-primary-ink' : 'text-muted hover:bg-subtle hover:text-foreground',
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

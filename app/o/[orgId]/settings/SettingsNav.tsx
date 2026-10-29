import Link from 'next/link';
import { cx } from '@/components/ui';

export function SettingsNav({ orgId, current, isOwner, isAdmin }: { orgId: string; current: 'general' | 'billing' | 'audit'; isOwner: boolean; isAdmin: boolean }) {
  const tabs = [
    { key: 'general', label: 'Team & workspace', href: `/o/${orgId}/settings`, show: true },
    { key: 'billing', label: 'Plan & billing', href: `/o/${orgId}/settings/billing`, show: isOwner },
    { key: 'audit', label: 'Audit log', href: `/o/${orgId}/settings/audit`, show: isAdmin },
  ].filter((t) => t.show);
  return (
    <nav aria-label="Settings" className="mb-6 flex gap-1 border-b border-border">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === current ? 'page' : undefined}
          className={cx(
            '-mb-px border-b-2 px-3 py-2 text-sm font-medium',
            tab.key === current ? 'border-primary text-primary-ink' : 'border-transparent text-muted hover:text-foreground',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

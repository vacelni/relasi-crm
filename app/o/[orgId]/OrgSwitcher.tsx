'use client';

import { useRouter } from 'next/navigation';

export function OrgSwitcher({ current, workspaces }: { current: string; workspaces: { id: string; name: string }[] }) {
  const router = useRouter();
  return (
    <select
      aria-label="Workspace"
      value={current}
      onChange={(event) => router.push(event.target.value === 'new' ? '/onboarding' : `/o/${event.target.value}`)}
      className="max-w-48 truncate rounded-control border border-border bg-subtle px-2 py-1.5 text-sm font-medium lg:w-full lg:max-w-none"
    >
      {workspaces.map((w) => (
        <option key={w.id} value={w.id}>
          {w.name}
        </option>
      ))}
      <option value="new">+ New workspace</option>
    </select>
  );
}

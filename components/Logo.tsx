export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 font-semibold tracking-tight text-foreground">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#2c3e91" />
        <circle cx="11" cy="16" r="4.5" fill="none" stroke="#fff" strokeWidth="2.5" />
        <circle cx="21" cy="16" r="4.5" fill="none" stroke="#e8b33a" strokeWidth="2.5" />
      </svg>
      {compact ? null : <span className="text-lg">Relasi</span>}
    </span>
  );
}

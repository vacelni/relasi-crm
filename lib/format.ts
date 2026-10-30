/** Display helpers. Amounts are whole rupiah (bigint in the database, safe integers here). */

const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

export function formatRupiah(value: number): string {
  // Intl puts a non-breaking space after "Rp"; the compact form reads better in tables.
  return rupiah.format(value).replace(/ /g, '');
}

/** Rp45jt, Rp1,2M: for chart labels and Kanban column totals. */
export function formatRupiahShort(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  const units: [number, string][] = [
    [1e12, 'T'],
    [1e9, 'M'],
    [1e6, 'jt'],
    [1e3, 'rb'],
  ];
  for (const [size, unit] of units) {
    if (abs >= size) {
      const scaled = abs / size;
      const digits = scaled >= 100 || Number.isInteger(scaled) ? 0 : 1;
      return `${sign}Rp${scaled.toFixed(digits).replace('.', ',')}${unit}`;
    }
  }
  return `${sign}Rp${abs}`;
}

/** Parses what people type into a rupiah field: "45.000.000", "Rp 45,000,000", "45000000". */
export function parseRupiah(input: string): number | null {
  const digits = input.replace(/^\s*rp\.?\s*/i, '').replace(/[.,\s]/g, '');
  if (!/^\d{1,13}$/.test(digits)) return null;
  return Number(digits);
}

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' });
const dateTimeFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Jakarta',
});

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}

/** "3 days ago", "in 2 days", "today": for activity timelines and due dates. */
export function formatRelativeDays(iso: string, now: Date = new Date()): string {
  const day = 24 * 60 * 60 * 1000;
  const startOfDay = (d: Date) => {
    // Calendar days in Jakarta (UTC+7, no DST).
    const local = new Date(d.getTime() + 7 * 60 * 60 * 1000);
    return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  };
  const diff = Math.round((startOfDay(new Date(iso)) - startOfDay(now)) / day);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  return diff > 0 ? `in ${diff} days` : `${-diff} days ago`;
}

/** ISO timestamp `hours` before now: the start of rolling windows such as the AI quota's 24 hours. */
export function isoHoursAgo(hours: number, now: Date = new Date()): string {
  return new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
}

/** WhatsApp click-to-chat link. Indonesian numbers starting with 0 become +62. */
export function whatsappLink(phone: string, text?: string): string | null {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export const ACTIVITY_KIND_LABEL: Record<string, string> = {
  note: 'Note',
  call: 'Call',
  meeting: 'Meeting',
  email: 'Email',
  whatsapp: 'WhatsApp',
  task: 'Task',
};

/** The verb for an activity feed line: "Rina called Dewi", "Budi chatted on WhatsApp with Yusuf". */
export function activityVerb(kind: string): { verb: string; withContact: string } {
  switch (kind) {
    case 'call':
      return { verb: 'called', withContact: '' };
    case 'meeting':
      return { verb: 'met', withContact: '' };
    case 'email':
      return { verb: 'emailed', withContact: '' };
    case 'whatsapp':
      return { verb: 'chatted on WhatsApp', withContact: 'with' };
    case 'task':
      return { verb: 'completed a task', withContact: 'for' };
    default:
      return { verb: 'added a note', withContact: 'on' };
  }
}

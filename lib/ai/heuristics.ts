import { formatRupiah } from '@/lib/format';
import type { ExtractedContact, FollowUpDraft, LeadScore } from './schemas';
import type { ContactContext, FollowUpRequest } from './types';

/**
 * Rule-based fallbacks for every AI feature. They run when no ANTHROPIC_API_KEY is configured
 * (local development, forks, the demo without a key) so the product still works end to end,
 * and the UI labels their results as heuristic. Deterministic, so they are unit-tested.
 */

const DAY = 24 * 60 * 60 * 1000;

function daysSince(iso: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(iso).getTime()) / DAY);
}

function history(ctx: ContactContext) {
  return ctx.activities.filter((a) => a.kind !== 'task' || a.completed_at);
}

function openTasks(ctx: ContactContext) {
  return ctx.activities.filter((a) => a.kind === 'task' && !a.completed_at);
}

function firstSentence(text: string): string {
  const sentence = text.split(/(?<=[.!?])\s/)[0] ?? text;
  return sentence.length > 140 ? `${sentence.slice(0, 137)}...` : sentence;
}

export function heuristicSummary(ctx: ContactContext): string {
  const { contact, deals, now } = ctx;
  const bullets: string[] = [];
  const who = [contact.title, contact.company?.name].filter(Boolean).join(' at ');
  bullets.push(`${contact.full_name}${who ? `, ${who}` : ''}; status: ${contact.status}.${contact.notes ? ` ${firstSentence(contact.notes)}` : ''}`);

  const open = deals.filter((d) => d.stage_kind === 'open');
  if (open.length > 0) {
    const total = open.reduce((sum, d) => sum + d.value, 0);
    const furthest = [...open].sort((a, b) => b.probability - a.probability)[0]!;
    bullets.push(`${open.length} open deal${open.length > 1 ? 's' : ''} worth ${formatRupiah(total)}; furthest along: "${furthest.title}" in ${furthest.stage}.`);
  } else if (deals.some((d) => d.stage_kind === 'won')) {
    bullets.push('No open deals; has bought before.');
  }

  const past = history(ctx);
  const latest = past[0];
  if (latest) {
    const ago = daysSince(latest.created_at, now);
    bullets.push(`Last interaction ${ago === 0 ? 'today' : `${ago} days ago`} (${latest.kind}): ${latest.body ? firstSentence(latest.body) : latest.subject}`);
  } else {
    bullets.push('No interactions logged yet.');
  }

  const tasks = openTasks(ctx);
  const overdue = tasks.filter((t) => t.due_at && new Date(t.due_at) < now);
  if (tasks.length > 0) {
    bullets.push(`Next step: ${tasks[0]!.subject}${overdue.length > 0 ? ` (${overdue.length} task${overdue.length > 1 ? 's' : ''} overdue)` : ''}.`);
  } else if (!latest || daysSince(latest.created_at, now) > 14) {
    bullets.push('Next step: reach out; it has been quiet for a while.');
  }
  return bullets.map((b) => `- ${b}`).join('\n');
}

// Signals in notes and interaction text. Each matches once per contact.
const SIGNALS: { pattern: RegExp; points: number; reason: string }[] = [
  { pattern: /budget (is )?(approved|ready|allocated)|anggaran (sudah )?(disetujui|ada)/i, points: 15, reason: 'Budget is approved' },
  { pattern: /before|deadline|go-live|launch|opens? in|weeks?\b|bulan depan|minggu depan/i, points: 8, reason: 'Has a timeline' },
  { pattern: /not the decision maker|director decides|bukan pengambil keputusan/i, points: -12, reason: 'Not the decision maker' },
  { pattern: /cheaper|lower price|price sensitive|discount|lebih murah|diskon/i, points: -8, reason: 'Price sensitive' },
  { pattern: /paused|cash flow|check back|ditunda/i, points: -15, reason: 'Project paused' },
  { pattern: /liked it|happy with|interested|tertarik|cocok/i, points: 6, reason: 'Positive feedback' },
];

export function heuristicLeadScore(ctx: ContactContext): LeadScore {
  const { contact, deals, now } = ctx;
  const scored: { points: number; reason: string }[] = [];

  const statusPoints = { lead: 15, qualified: 30, customer: 40, churned: 5 }[contact.status];
  scored.push({ points: statusPoints, reason: `Status is ${contact.status}` });

  const open = deals.filter((d) => d.stage_kind === 'open');
  if (open.length > 0) {
    const best = Math.max(...open.map((d) => d.probability));
    scored.push({ points: Math.round(best * 0.3), reason: `Open deal at ${best}% stage probability` });
  }
  if (deals.some((d) => d.stage_kind === 'won')) scored.push({ points: 10, reason: 'Has bought before' });

  const recent = history(ctx).filter((a) => daysSince(a.created_at, now) <= 14).length;
  if (recent > 0) scored.push({ points: Math.min(recent * 6, 15), reason: `${recent} interaction${recent > 1 ? 's' : ''} in the last 14 days` });
  else scored.push({ points: -5, reason: 'No interaction in the last 14 days' });

  const text = [contact.notes ?? '', ...ctx.activities.map((a) => `${a.subject} ${a.body ?? ''}`)].join('\n');
  for (const signal of SIGNALS) {
    if (signal.pattern.test(text)) scored.push(signal);
  }

  const score = Math.max(0, Math.min(100, scored.reduce((sum, s) => sum + s.points, 0)));
  const reasons = [...scored]
    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
    .slice(0, 4)
    .map((s) => `${s.reason} (${s.points >= 0 ? '+' : ''}${s.points})`);

  const tasks = openTasks(ctx);
  const nextStep = tasks[0]?.subject ?? (open.length > 0 ? `Follow up on "${open[0]!.title}"` : 'Qualify budget, timeline, and decision maker');
  return { score, temperature: score >= 70 ? 'hot' : score >= 40 ? 'warm' : 'cold', reasons, next_step: nextStep };
}

export function heuristicFollowUp(ctx: ContactContext, request: FollowUpRequest): FollowUpDraft {
  const firstName = ctx.contact.full_name.replace(/^(dr|ir|drs|prof)\.?\s+/i, '').split(/\s+/)[0] ?? ctx.contact.full_name;
  const latest = history(ctx)[0];
  const topic = latest?.subject.toLowerCase() ?? 'our last conversation';
  const goal = request.goal.trim();

  if (request.language === 'id') {
    const body = [
      `Halo ${firstName}, semoga sehat selalu.`,
      `Saya ingin menindaklanjuti ${latest ? `soal "${latest.subject}"` : 'pembicaraan kita sebelumnya'}.`,
      goal ? `${goal.charAt(0).toUpperCase()}${goal.slice(1)}.` : 'Apakah ada waktu minggu ini untuk ngobrol sebentar?',
      request.channel === 'email' ? `\nSalam,\n${request.senderName}` : `Terima kasih. - ${request.senderName}`,
    ].join(' ');
    return { subject: request.channel === 'email' ? `Tindak lanjut: ${latest?.subject ?? ctx.contact.company?.name ?? 'diskusi kita'}` : null, message: body.replace(' \n', '\n') };
  }
  const body = [
    `Hi ${firstName}, I hope you are well.`,
    `I wanted to follow up on ${latest ? `"${topic}"` : 'our last conversation'}.`,
    goal ? `${goal.charAt(0).toUpperCase()}${goal.slice(1)}.` : 'Do you have 15 minutes this week for a quick call?',
    request.channel === 'email' ? `\nBest regards,\n${request.senderName}` : `Thanks! - ${request.senderName}`,
  ].join(' ');
  return { subject: request.channel === 'email' ? `Following up: ${latest?.subject ?? 'our conversation'}` : null, message: body.replace(' \n', '\n') };
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE = /(?:\+62[ .-]?|62|0)8[0-9][0-9 .-]{6,14}[0-9]/;
const TITLE_WORDS = /\b(owner|founder|ceo|cto|director|direktur|manager|manajer|head|lead|marketing|sales|admin|pemilik|staff|kepala)\b/i;

/**
 * Splits the text into blocks (blank lines, or one person per line in a list) and keeps the
 * blocks that contain an email or phone number. The name is the first line without contact
 * details; a "Name - Title, Company" pattern fills title and company.
 */
export function heuristicExtract(text: string): ExtractedContact[] {
  const blocks = text
    .split(/\n\s*\n/)
    .flatMap((block) => {
      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
      const withDetails = lines.filter((l) => EMAIL.test(l) || PHONE.test(l));
      // A list with contact details on every line: one person per line.
      return withDetails.length > 1 && withDetails.length === lines.length ? lines.map((l) => [l]) : [lines];
    })
    .filter((lines) => lines.some((l) => EMAIL.test(l) || PHONE.test(l)));

  const contacts: ExtractedContact[] = [];
  for (const lines of blocks.slice(0, 25)) {
    const joined = lines.join('\n');
    const email = joined.match(EMAIL)?.[0].toLowerCase() ?? null;
    const phone = joined.match(PHONE)?.[0].replace(/[ .-]/g, '') ?? null;
    const rest = lines
      .map((l) => l.replace(EMAIL, '').replace(PHONE, '').replace(/\b(email|e-mail|wa|whatsapp|hp|telp|phone)\s*[:.]?/gi, '').trim())
      .map((l) => l.replace(/^[\s,;:|/-]+|[\s,;:|/-]+$/g, ''))
      .filter(Boolean);

    const [first = '', ...others] = rest;
    const parts = first.split(/\s+[-–|]\s+|,\s*/).map((p) => p.trim()).filter(Boolean);
    const fullName = parts[0] ?? (email ? email.split('@')[0]! : '');
    if (!fullName) continue;

    let title: string | null = null;
    let company: string | null = null;
    for (const part of [...parts.slice(1), ...others]) {
      if (!title && TITLE_WORDS.test(part)) title = part;
      else if (!company) company = part;
    }
    contacts.push({ full_name: fullName.slice(0, 120), email, phone, title, company, notes: null });
  }
  return contacts;
}

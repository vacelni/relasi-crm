'use client';

import { useState, useTransition } from 'react';
import { AiSourceNote } from '@/components/AiSourceNote';
import { Alert, Badge, Button, Card, inputClass } from '@/components/ui';
import { draftFollowUp, scoreContact, summarizeContact } from '@/features/ai/actions';
import type { FollowUpDraft } from '@/lib/ai/schemas';
import type { AiSource } from '@/lib/ai/types';
import { formatDateTime, whatsappLink } from '@/lib/format';

/** What scoreContact stores in contacts.ai_score_reasons. */
export type StoredScore = { reasons: string[]; next_step: string; temperature: 'hot' | 'warm' | 'cold'; source: AiSource };

const temperatureTone = { hot: 'success', warm: 'warning', cold: 'neutral' } as const;

export function AiPanel(props: {
  orgId: string;
  contactId: string;
  hasPhone: boolean;
  phone: string | null;
  email: string | null;
  summary: string | null;
  score: number | null;
  scoreDetails: StoredScore | null;
  updatedAt: string | null;
}) {
  const { orgId, contactId } = props;
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<'summary' | 'score' | 'draft' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ source: AiSource; remaining: number | null } | null>(null);

  const [summary, setSummary] = useState(props.summary);
  const [score, setScore] = useState(props.score);
  const [details, setDetails] = useState(props.scoreDetails);

  const [channel, setChannel] = useState<'whatsapp' | 'email'>(props.hasPhone ? 'whatsapp' : 'email');
  const [language, setLanguage] = useState<'id' | 'en'>('id');
  const [goal, setGoal] = useState('');
  const [draft, setDraft] = useState<FollowUpDraft | null>(null);
  const [copied, setCopied] = useState(false);

  function runAction(kind: 'summary' | 'score' | 'draft') {
    setError(null);
    setBusy(kind);
    startTransition(async () => {
      try {
        if (kind === 'summary') {
          const result = await summarizeContact(orgId, contactId);
          if (!result.ok) return setError(result.error);
          setSummary(result.data.summary);
          setMeta(result.data);
        } else if (kind === 'score') {
          const result = await scoreContact(orgId, contactId);
          if (!result.ok) return setError(result.error);
          setScore(result.data.score);
          setDetails({ ...result.data });
          setMeta(result.data);
        } else {
          const result = await draftFollowUp(orgId, contactId, { channel, language, goal });
          if (!result.ok) return setError(result.error);
          setDraft({ subject: result.data.subject, message: result.data.message });
          setCopied(false);
          setMeta(result.data);
        }
      } finally {
        setBusy(null);
      }
    });
  }

  const draftText = draft ? (draft.subject ? `Subject: ${draft.subject}\n\n${draft.message}` : draft.message) : '';
  const wa = draft && channel === 'whatsapp' && props.phone ? whatsappLink(props.phone, draft.message) : null;
  const mailto =
    draft && channel === 'email' && props.email
      ? `mailto:${props.email}?subject=${encodeURIComponent(draft.subject ?? '')}&body=${encodeURIComponent(draft.message)}`
      : null;

  return (
    <Card className="border-ai-border">
      <div className="flex items-center justify-between gap-3 border-b border-ai-border bg-ai-soft/60 px-4 py-3">
        <h2 className="text-sm font-semibold text-ai">✦ AI assistant</h2>
        {props.updatedAt ? <span className="text-xs text-muted">Last run {formatDateTime(props.updatedAt)}</span> : null}
      </div>

      <div className="space-y-5 p-4">
        {error ? <Alert>{error}</Alert> : null}

        <section aria-labelledby="ai-summary">
          <div className="flex items-center justify-between gap-2">
            <h3 id="ai-summary" className="text-sm font-semibold">
              Relationship summary
            </h3>
            <Button type="button" variant="secondary" size="sm" onClick={() => runAction('summary')} disabled={pending}>
              {busy === 'summary' ? 'Summarizing…' : summary ? 'Refresh' : 'Summarize'}
            </Button>
          </div>
          {summary ? (
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{summary}</p>
          ) : (
            <p className="mt-2 text-sm text-muted">Reads the notes, interactions, deals, and open tasks for this contact.</p>
          )}
        </section>

        <section aria-labelledby="ai-score" className="border-t border-border pt-4">
          <div className="flex items-center justify-between gap-2">
            <h3 id="ai-score" className="text-sm font-semibold">
              Lead score
            </h3>
            <Button type="button" variant="secondary" size="sm" onClick={() => runAction('score')} disabled={pending}>
              {busy === 'score' ? 'Scoring…' : score != null ? 'Re-score' : 'Score lead'}
            </Button>
          </div>
          {score != null && details ? (
            <div className="mt-2 space-y-2 text-sm">
              <p className="flex items-center gap-2">
                <span className="text-2xl font-semibold tabular-nums">{score}</span>
                <span className="text-muted">/ 100</span>
                <Badge tone={temperatureTone[details.temperature]}>{details.temperature}</Badge>
              </p>
              <ul className="list-disc space-y-0.5 pl-5 text-muted">
                {details.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
              <p>
                <span className="font-medium">Next step:</span> {details.next_step}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">A 0-100 likelihood to buy in the next 90 days, with the evidence behind it.</p>
          )}
        </section>

        <section aria-labelledby="ai-draft" className="border-t border-border pt-4">
          <h3 id="ai-draft" className="text-sm font-semibold">
            Follow-up draft
          </h3>
          <div className="mt-2 grid gap-2 sm:grid-cols-[auto_auto_1fr_auto]">
            <select aria-label="Channel" value={channel} onChange={(e) => setChannel(e.target.value as 'whatsapp' | 'email')} className={inputClass}>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
            </select>
            <select aria-label="Language" value={language} onChange={(e) => setLanguage(e.target.value as 'id' | 'en')} className={inputClass}>
              <option value="id">Bahasa Indonesia</option>
              <option value="en">English</option>
            </select>
            <input
              aria-label="Goal of the message (optional)"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              maxLength={300}
              placeholder="Goal (optional): e.g. confirm the meeting on Friday"
              className={inputClass}
            />
            <Button type="button" variant="ai" size="md" onClick={() => runAction('draft')} disabled={pending}>
              {busy === 'draft' ? 'Drafting…' : 'Draft'}
            </Button>
          </div>
          {draft ? (
            <div className="mt-3 space-y-2">
              {draft.subject !== null ? (
                <input
                  aria-label="Subject"
                  value={draft.subject}
                  onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                  className={inputClass}
                />
              ) : null}
              <textarea
                aria-label="Draft message"
                value={draft.message}
                onChange={(e) => setDraft({ ...draft, message: e.target.value })}
                rows={channel === 'email' ? 8 : 5}
                className={inputClass}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    await navigator.clipboard.writeText(draftText);
                    setCopied(true);
                  }}
                >
                  {copied ? 'Copied' : 'Copy'}
                </Button>
                {wa ? (
                  <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center rounded-control bg-success px-3 text-sm font-medium text-white hover:bg-success/90">
                    Open in WhatsApp
                  </a>
                ) : null}
                {mailto ? (
                  <a href={mailto} className="inline-flex h-8 items-center rounded-control bg-primary px-3 text-sm font-medium text-white hover:bg-primary-hover">
                    Open in email
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>

        {meta ? <AiSourceNote source={meta.source} remaining={meta.remaining} /> : null}
      </div>
    </Card>
  );
}

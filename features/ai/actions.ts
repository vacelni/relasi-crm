'use server';

import { revalidatePath } from 'next/cache';
import { AiError, aiConfigured, generateObject, generateText, type AiUsage } from '@/lib/ai/claude';
import { heuristicExtract, heuristicFollowUp, heuristicLeadScore, heuristicSummary } from '@/lib/ai/heuristics';
import { extractionInput, followUpInstruction, MAX_EXTRACT_CHARS, renderContactContext, SYSTEM } from '@/lib/ai/prompts';
import { extractionSchema, followUpSchema, leadScoreSchema, type ExtractedContact, type FollowUpDraft, type LeadScore } from '@/lib/ai/schemas';
import type { AiSource, FollowUpRequest } from '@/lib/ai/types';
import { friendlyDbError, isUuid, type ActionResult } from '@/lib/errors';
import { requireOrg, type OrgContext } from '@/lib/org';
import { loadContactContext } from './data';

type Feature = 'summary' | 'lead_score' | 'follow_up' | 'extract';
type WithSource<T> = T & { source: AiSource; remaining: number | null };

/**
 * Runs one AI feature: Claude when configured (after reserving quota in the database, which
 * also enforces the per-user burst limit), otherwise the heuristic, which costs nothing and is
 * not metered.
 */
async function run<T>(
  ctx: OrgContext,
  feature: Feature,
  viaClaude: () => Promise<{ result: T; usage: AiUsage }>,
  viaHeuristic: () => T,
): Promise<ActionResult<WithSource<T>>> {
  if (!aiConfigured()) return { ok: true, data: { ...viaHeuristic(), source: 'heuristic', remaining: null } };

  const { data, error } = await ctx.supabase.rpc('consume_ai_quota', { p_org: ctx.org.id, p_feature: feature });
  if (error) {
    const message = friendlyDbError(error);
    return { ok: false, error: error.hint === 'quota' ? `${message} Upgrade to Pro for more.` : message };
  }

  // A function with OUT parameters returns one record.
  const quota = data as { usage_id: number; remaining: number };
  try {
    const { result, usage } = await viaClaude();
    await ctx.supabase.rpc('record_ai_tokens', {
      p_usage_id: quota.usage_id,
      p_input: usage.input_tokens,
      p_output: usage.output_tokens,
    });
    return { ok: true, data: { ...result, source: 'claude', remaining: quota.remaining } };
  } catch (err) {
    if (err instanceof AiError) return { ok: false, error: err.message };
    throw err;
  }
}

async function contactContext(orgId: string, contactId: string) {
  if (!isUuid(contactId)) return null;
  const ctx = await requireOrg(orgId);
  const data = await loadContactContext(ctx, contactId);
  return data ? { ctx, data } : null;
}

export async function summarizeContact(orgId: string, contactId: string): Promise<ActionResult<WithSource<{ summary: string }>>> {
  const loaded = await contactContext(orgId, contactId);
  if (!loaded) return { ok: false, error: 'Contact not found.' };
  const { ctx, data } = loaded;

  const outcome = await run(
    ctx,
    'summary',
    async () => {
      const { text, usage } = await generateText(SYSTEM.summary, renderContactContext(data));
      return { result: { summary: text }, usage };
    },
    () => ({ summary: heuristicSummary(data) }),
  );
  if (outcome.ok) {
    const { error } = await ctx.supabase.rpc('save_contact_ai', { p_contact: contactId, p_summary: outcome.data.summary });
    if (error) return { ok: false, error: friendlyDbError(error) };
    revalidatePath(`/o/${orgId}/contacts/${contactId}`);
  }
  return outcome;
}

export async function scoreContact(orgId: string, contactId: string): Promise<ActionResult<WithSource<LeadScore>>> {
  const loaded = await contactContext(orgId, contactId);
  if (!loaded) return { ok: false, error: 'Contact not found.' };
  const { ctx, data } = loaded;

  const outcome = await run(
    ctx,
    'lead_score',
    async () => {
      const { data: result, usage } = await generateObject(SYSTEM.leadScore, renderContactContext(data), leadScoreSchema);
      return { result, usage };
    },
    () => heuristicLeadScore(data),
  );
  if (outcome.ok) {
    const { score, reasons, next_step, temperature } = outcome.data;
    const { error } = await ctx.supabase.rpc('save_contact_ai', {
      p_contact: contactId,
      p_score: score,
      p_reasons: { reasons, next_step, temperature, source: outcome.data.source },
    });
    if (error) return { ok: false, error: friendlyDbError(error) };
    revalidatePath(`/o/${orgId}`, 'layout');
  }
  return outcome;
}

export async function draftFollowUp(
  orgId: string,
  contactId: string,
  input: Pick<FollowUpRequest, 'channel' | 'language' | 'goal'>,
): Promise<ActionResult<WithSource<FollowUpDraft>>> {
  const loaded = await contactContext(orgId, contactId);
  if (!loaded) return { ok: false, error: 'Contact not found.' };
  const { ctx, data } = loaded;
  const request: FollowUpRequest = {
    channel: input.channel === 'email' ? 'email' : 'whatsapp',
    language: input.language === 'en' ? 'en' : 'id',
    goal: String(input.goal ?? '').slice(0, 300),
    senderName: ctx.user.fullName ?? ctx.user.email.split('@')[0]!,
  };

  return run(
    ctx,
    'follow_up',
    async () => {
      const { data: result, usage } = await generateObject(
        SYSTEM.followUp,
        `${renderContactContext(data)}\n\n${followUpInstruction(request)}`,
        followUpSchema,
      );
      return { result: request.channel === 'whatsapp' ? { ...result, subject: null } : result, usage };
    },
    () => heuristicFollowUp(data, request),
  );
}

export async function extractContacts(orgId: string, text: string): Promise<ActionResult<WithSource<{ contacts: ExtractedContact[] }>>> {
  const input = String(text ?? '');
  if (!input.trim()) return { ok: false, error: 'Paste some text first.' };
  if (input.length > MAX_EXTRACT_CHARS) return { ok: false, error: `Paste at most ${MAX_EXTRACT_CHARS.toLocaleString('en')} characters at a time.` };
  const ctx = await requireOrg(orgId);

  return run(
    ctx,
    'extract',
    async () => {
      const { data: result, usage } = await generateObject(SYSTEM.extract, extractionInput(input), extractionSchema);
      return { result, usage };
    },
    () => ({ contacts: heuristicExtract(input) }),
  );
}

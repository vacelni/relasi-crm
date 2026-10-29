import { z } from 'zod';

/**
 * Structured outputs. The SDK turns these into the request's JSON schema and validates the
 * answer against them again (constraints like min/max are enforced on our side).
 */

export const leadScoreSchema = z.object({
  score: z.number().int().min(0).max(100).describe('Likelihood to buy in the next 90 days, 0-100.'),
  temperature: z.enum(['hot', 'warm', 'cold']),
  reasons: z
    .array(z.string().max(200))
    .min(1)
    .max(4)
    .describe('2-4 short reasons, each citing specific evidence from the data.'),
  next_step: z.string().max(200).describe('The single most useful next action for the salesperson.'),
});
export type LeadScore = z.infer<typeof leadScoreSchema>;

export const followUpSchema = z.object({
  subject: z.string().max(120).nullable().describe('Email subject line; null for WhatsApp.'),
  message: z.string().max(2000),
});
export type FollowUpDraft = z.infer<typeof followUpSchema>;

export const extractedContactSchema = z.object({
  full_name: z.string().max(120),
  email: z.string().max(200).nullable(),
  phone: z.string().max(30).nullable(),
  title: z.string().max(120).nullable(),
  company: z.string().max(120).nullable(),
  notes: z.string().max(500).nullable().describe('Anything else about this person worth keeping, e.g. what they asked for.'),
});
export type ExtractedContact = z.infer<typeof extractedContactSchema>;

export const extractionSchema = z.object({
  contacts: z.array(extractedContactSchema).max(25),
});

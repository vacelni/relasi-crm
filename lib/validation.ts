import { z } from 'zod';
import { parseRupiah } from '@/lib/format';

/**
 * Form schemas for the Server Actions. They mirror the database CHECK constraints so the user
 * sees a field message instead of a failed insert; the database stays the source of truth.
 */

// Empty form fields arrive as ''. Optional text fields store NULL instead.
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `At most ${max} characters.`)
    .transform((value) => (value === '' ? null : value));

const uuidOrNull = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .pipe(z.uuid().nullable());

export const contactSchema = z.object({
  full_name: z.string().trim().min(1, 'Name is required.').max(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .transform((value) => (value === '' ? null : value))
    .pipe(z.email('Enter a valid email.').nullable()),
  phone: optionalText(20).refine((value) => value === null || /^\+?[0-9 ()-]{6,20}$/.test(value), 'Enter a valid phone number.'),
  title: optionalText(120),
  company_id: uuidOrNull,
  status: z.enum(['lead', 'qualified', 'customer', 'churned']),
  source: z.enum(['manual', 'referral', 'website', 'whatsapp', 'other', 'import', 'ai_extract']).default('manual'),
  notes: optionalText(4000),
});

export const companySchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(120),
  domain: optionalText(120),
  industry: optionalText(80),
});

export const dealSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.').max(160),
  value: z
    .string()
    .transform((value, ctx) => {
      if (value.trim() === '') return 0;
      const parsed = parseRupiah(value);
      if (parsed === null || parsed > 1_000_000_000_000) {
        ctx.addIssue({ code: 'custom', message: 'Enter an amount in rupiah, e.g. 15.000.000.' });
        return z.NEVER;
      }
      return parsed;
    }),
  stage_id: z.uuid('Choose a stage.'),
  contact_id: uuidOrNull,
  expected_close: z
    .string()
    .trim()
    .transform((value) => (value === '' ? null : value))
    .pipe(z.iso.date('Enter a valid date.').nullable()),
});

export const activitySchema = z.object({
  kind: z.enum(['note', 'call', 'meeting', 'email', 'whatsapp', 'task']),
  subject: z.string().trim().min(1, 'Subject is required.').max(200),
  body: optionalText(4000),
  // <input type="datetime-local"> has no zone; the team works in WIB (UTC+7).
  due_at: z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (value === '') return null;
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
        ctx.addIssue({ code: 'custom', message: 'Enter a valid date and time.' });
        return z.NEVER;
      }
      return new Date(`${value}:00+07:00`).toISOString();
    }),
});

export const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email.')),
  role: z.enum(['admin', 'sales']),
});

export const orgNameSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(80, 'At most 80 characters.'),
});

/** FormData → plain object of strings (missing fields become ''). */
export function formValues(formData: FormData, keys: readonly string[]): Record<string, string> {
  return Object.fromEntries(keys.map((key) => [key, String(formData.get(key) ?? '')]));
}

/** The first message per field, for showing next to inputs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    result[key] ??= issue.message;
  }
  return result;
}

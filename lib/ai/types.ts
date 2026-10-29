/** The CRM data the AI features read. Loaded under RLS by features/ai/data.ts. */

export type ContactForAi = {
  full_name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  status: 'lead' | 'qualified' | 'customer' | 'churned';
  source: string;
  notes: string | null;
  created_at: string;
  company: { name: string; industry: string | null } | null;
};

export type ActivityForAi = {
  kind: string;
  subject: string;
  body: string | null;
  created_at: string;
  due_at: string | null;
  completed_at: string | null;
};

export type DealForAi = {
  title: string;
  value: number;
  stage: string;
  stage_kind: 'open' | 'won' | 'lost';
  probability: number;
  expected_close: string | null;
};

export type ContactContext = {
  contact: ContactForAi;
  /** Newest first. */
  activities: ActivityForAi[];
  deals: DealForAi[];
  now: Date;
};

export type FollowUpRequest = {
  channel: 'whatsapp' | 'email';
  language: 'id' | 'en';
  /** What the message should achieve, in the salesperson's words. Optional. */
  goal: string;
  senderName: string;
};

/** Which engine produced a result; the UI labels it. */
export type AiSource = 'claude' | 'heuristic';

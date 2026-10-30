# Relasi: Product Requirements

Status: v1 built · Owner: Vacelnino Faiz Fadeli · Last updated: 2026-10-30

This document was written after the first build, to record what v1 commits to and why. Changes in behaviour start
here; changes in architecture start with an [ADR](adr/README.md).

## 1. Problem

Small Indonesian businesses (UMKM) and small agencies sell through relationships, mostly on WhatsApp. Customer
knowledge lives in chat histories, a spreadsheet, and the owner's memory. When a salesperson leaves or a lead goes
quiet, nobody knows what was promised, and follow-ups are forgotten.

Existing CRMs (HubSpot, Pipedrive, Zoho) are priced and designed for Western sales teams: English-first, per-seat
prices in dollars, and a setup effort a five-person agency does not have.

## 2. Users

| Persona | Goal | Constraints |
| --- | --- | --- |
| **Owner** of an agency or UMKM | See the pipeline and revenue, make sure no lead is dropped | Pays for the tool; little time for setup |
| **Admin** (office manager, sales lead) | Keep the team's data clean, invite people, shape the pipeline | Not technical |
| **Sales rep** | Know who to contact today and what to say | Works from a phone between meetings; writes in Bahasa Indonesia |

## 3. Goals

1. A new team goes from sign-up to its first contacts in under five minutes (sign up → workspace → CSV import or
   paste).
2. A sales rep opening a contact can understand the relationship and send a follow-up without reading the whole
   history.
3. One workspace can never see another's data, and a rep cannot change records that are not theirs, whatever the
   client sends.
4. The AI never blocks the CRM: without a key, over quota, or during an outage, every screen still works.

## 4. Non-goals (v1)

- Sending WhatsApp or email from the app (drafts open in WhatsApp or the mail client; no Business API).
- Custom fields, multiple pipelines per workspace, or per-workspace AI prompts.
- Native mobile apps (the web app is responsive instead).
- Real payments: Midtrans runs in sandbox mode only.
- Marketing automation, email campaigns, or calendar sync.

## 5. Scope

### Must have (v1, built)

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| F-01 | Sign up, create a workspace, switch between workspaces | A new user lands in onboarding; after creating a workspace they are its owner |
| F-02 | Roles `owner`, `admin`, `sales` | Permissions match the README table and are enforced by RLS (pgTAP tests per role) |
| F-03 | Invite teammates by link | The link works once, for the invited email, within 7 days, and only while a seat is free |
| F-04 | Contacts and companies with search, filters, owner, status | Status moves lead → qualified → customer (or churned) |
| F-05 | Pipeline board with stages and probabilities | Drag with mouse or touch; moving to Won/Lost closes the deal; reps move only their own deals |
| F-06 | Activities and tasks | Log call, meeting, WhatsApp, note; tasks with due dates; overdue tasks on the dashboard |
| F-07 | Dashboard | Open and weighted pipeline, revenue won and win rate over 90 days, value per stage, hottest leads |
| F-08 | CSV import | Detects English and Indonesian headers, maps columns, validates each line, skips duplicates |
| F-09 | AI relationship summary | From the contact's whole history; says which engine produced it |
| F-10 | AI lead score 0–100 | Shows the evidence and a next step, not just a number |
| F-11 | AI follow-up draft | WhatsApp or email, Indonesian or English, one-click "Open in WhatsApp" |
| F-12 | AI contact extraction | From a pasted card, signature, or chat; the user reviews before anything is saved |
| F-13 | Plans and billing | Free and Pro limits enforced in the database; Pro bought through Midtrans Snap (sandbox) |
| F-14 | Audit log | Every change to contacts, companies, deals, stages, and memberships; admins only |
| F-15 | Public demo | One click as owner or as sales; the demo resets every hour |

### Later

- Scheduled reminders by email or WhatsApp for due tasks.
- Custom fields and multiple pipelines.
- AI evals on a labelled contact set, to compare prompts and models with numbers.

## 6. Plans

| | Free | Pro |
| --- | --- | --- |
| Seats | 3 | 25 |
| AI calls per day | 30 | 500 |
| Price | Rp0 | Rp149.000 per month, or 10 months' price for a year |

A Pro plan that is not renewed falls back to Free limits; no data is deleted.

## 7. Non-functional requirements

- **Security:** tenant isolation and role checks in Postgres (RLS, column grants, composite foreign keys);
  secrets server-only; CSP with `connect-src 'self'`; signed and re-verified payment notifications.
- **AI cost:** a cheap model (Claude Haiku), per-workspace daily quota and 8 calls per minute per user, reserved
  before the call.
- **Prompt injection:** CRM text is treated as data, never as instructions.
- **Mobile:** every screen usable at 360 px wide; the board works with touch.
- **Language:** UI in English for v1; AI output and imports handle Bahasa Indonesia.
- **Cost to run:** Vercel and Supabase free tiers.

## 8. Success metrics

| Metric | Target | How it is measured |
| --- | --- | --- |
| Time from sign-up to first contact | < 5 min | E2E test walks the flow; manual timing on the demo |
| Cross-tenant reads or writes | 0 | pgTAP isolation tests in CI |
| AI calls that fail without a usable message | 0 | Error mapping in `lib/ai/claude.ts`, unit tests against a stub API |
| AI usefulness (summary and score judged correct) | ≥ 80% on a labelled set | Not measured yet: see "Later" |

## 9. Risks and open questions

| Risk / question | Mitigation |
| --- | --- |
| A wrong RLS policy leaks data between workspaces | Composite foreign keys, default-deny grants, pgTAP per role and per table |
| AI cost grows with abuse of the free plan | Quota reserved in the database before every call; demo resets do not refill it |
| The AI invents facts about a customer | Prompts only pass stored data; the lead score must cite evidence; extraction is reviewed before saving |
| The Midtrans signature does not cover the transaction status | The webhook re-reads the status from the Midtrans API and checks the amount |
| Supabase free tier allows two active projects | The hosted demo needs its own project: a second organization or a paid plan |
| Not yet tested against the real Claude API | Run the AI features once with a real key before announcing the demo |

## 10. Milestones

| Milestone | Contents | Status |
| --- | --- | --- |
| M1 Core CRM | F-01 – F-08, F-14 | Done |
| M2 AI assistant | F-09 – F-12 with heuristic fallback and quotas | Done (stub-tested) |
| M3 Billing | F-13 in Midtrans sandbox | Done |
| M4 Public demo | F-15 deployed on Vercel + Supabase | Blocked on a Supabase project and API keys |

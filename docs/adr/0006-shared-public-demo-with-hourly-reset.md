# 0006. One shared public demo workspace, reset hourly in the database

- Status: accepted
- Date: 2026-10-30

## Context

Recruiters and visitors should be able to try the app in one click, without signing up, and always see realistic
data. Visitors will edit and delete things.

## Options considered

1. **A fresh sandbox workspace per visitor**: private to each visitor, but it needs cleanup and multiplies rows and
   AI usage.
2. **One shared demo workspace with fixed accounts (owner and sales), rebuilt on a schedule.**

## Decision

Option 2. `public.reset_demo()` (re)creates the two accounts and a workspace of fictional data. The seed calls it
locally, and the hosted project runs it hourly with `pg_cron` (`supabase/demo/schedule.sql`). The schedule is not a
migration, so local and CI databases never reset themselves. Demo guards block the actions that would spoil the
demo for the next visitor.

## Consequences

- Good: no sign-up friction, and every visitor starts from the same story.
- Good: AI usage rows survive the reset, so a reset does not refill the daily quota.
- Trade-off: visitors see each other's changes within the hour. A banner says so.
- The demo must run on its **own** Supabase project, never next to real customer data.

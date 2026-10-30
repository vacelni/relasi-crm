# 0002. Shared-schema multi-tenancy enforced by Postgres RLS

- Status: accepted
- Date: 2026-10-30

## Context

Many small workspaces, each with a few users and a few thousand rows. A leak between workspaces is the worst
possible bug for a CRM. Roles inside a workspace (owner, admin, sales) differ in what they may change.

## Options considered

1. **Database or schema per tenant**: strong isolation, but migrations multiply and the free tier cannot host it.
2. **Shared tables, checks in application code**: simple, but one forgotten `where org_id = ...` leaks data.
3. **Shared tables with `org_id` on every row, enforced by row-level security**: the database refuses what the
   policies do not allow, whatever the application sends.

## Decision

Option 3, with defence in depth:

- Every tenant-owned table carries `org_id`; policies check membership and role through `security definer`
  helpers.
- References between tenant rows are **composite foreign keys `(id, org_id)`**, so a row cannot point into another
  workspace even if a policy were wrong.
- **Column-level grants**: `org_id` is not updatable, and AI columns are written only through an RPC.
- `alter default privileges ... revoke`: new tables and functions start with no client privileges, so a forgotten
  grant fails closed.

## Consequences

- Good: isolation is tested where it lives. pgTAP covers every table, every role, and cross-tenant attempts.
- Good: the payment webhook is the only code path that uses the service-role key.
- Trade-off: policy logic is in SQL, which fewer developers read fluently. The README security table summarizes it.
- Trade-off: RLS adds a per-row cost; indexes that start with `org_id` keep it small at this scale.

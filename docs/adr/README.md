# Architecture Decision Records

Decisions that are expensive to reverse. An accepted ADR is never rewritten: a new one supersedes it.
Product scope lives in the [PRD](../PRD.md).

| ADR | Title | Status |
| --- | --- | --- |
| [0001](0001-nextjs-server-only-data-access.md) | Next.js App Router, all data access on the server | Accepted |
| [0002](0002-shared-schema-multi-tenancy-with-rls.md) | Shared-schema multi-tenancy enforced by Postgres RLS | Accepted |
| [0003](0003-business-rules-in-the-database.md) | Business rules as SQL functions, tested with pgTAP | Accepted |
| [0004](0004-claude-haiku-structured-outputs-with-fallback.md) | Claude Haiku with structured outputs, quotas, and a heuristic fallback | Accepted |
| [0005](0005-midtrans-snap-with-status-reverification.md) | Midtrans Snap, with the payment status re-read from the API | Accepted |
| [0006](0006-shared-public-demo-with-hourly-reset.md) | One shared public demo workspace, reset hourly in the database | Accepted |

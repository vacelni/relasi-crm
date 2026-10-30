# 0003. Business rules as SQL functions, tested with pgTAP

- Status: accepted
- Date: 2026-10-30

## Context

Some rules must hold no matter which client calls: seat limits, AI quotas, plan prices, invitation acceptance,
role changes, and the payment state machine. Two concurrent requests must not both take the last seat or the last
AI call.

## Options considered

1. **Rules in Server Actions**: easy to read, but racy (check, then write) and bypassable by any other client.
2. **Rules in SQL functions and triggers**: atomic, and the same for every caller.

## Decision

Option 2. Examples: `private.plan_limits()`, the seat-limit trigger, `consume_ai_quota()` (advisory lock per
workspace), invitation acceptance, and the billing functions that price an order on the server.

## Consequences

- Good: no race on limits, and a client cannot set its own price.
- Good: pgTAP tests run in CI on a fresh database, which also proves the migrations replay from zero.
- Trade-off: business logic lives in two languages (TypeScript and PL/pgSQL).
- Rule: guard triggers must not leak information to callers the policies reject (no "seat limit reached" message
  for a non-admin).

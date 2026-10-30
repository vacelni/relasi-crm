# 0001. Next.js App Router, all data access on the server

- Status: accepted
- Date: 2026-10-30

## Context

The app reads a lot (dashboard, board, lists) and writes in small forms. It calls three outside services:
Supabase, the Claude API, and Midtrans. Two of them need secret keys. The target is a free Vercel deployment.

## Options considered

1. **Single-page app talking to Supabase from the browser** (supabase-js + RLS): no server code, but AI and
   payment calls still need a server, and the browser would need `connect-src` to Supabase.
2. **Next.js App Router with Server Components for reads and Server Actions for writes**: one codebase, and the
   browser only talks to its own origin.
3. **Separate API (Express or FastAPI) plus an SPA**: clean boundary, but two deployments and duplicated types.

## Decision

Option 2. Server Components read with the signed-in user's Supabase session; Server Actions validate input with Zod
and write. The browser never calls Supabase, Claude, or Midtrans directly (it only loads the Snap checkout script).

## Consequences

- Good: the CSP can say `connect-src 'self'`; keys never reach the client; types flow from the database
  (`lib/database.types.ts`) to the UI.
- Good: every query still runs as the user, so RLS ([0002](0002-shared-schema-multi-tenancy-with-rls.md)) applies.
- Trade-off: no offline mode and no real-time updates from other users.
- Trade-off: Server Actions are public POST endpoints, so each one re-checks its input and relies on RLS, never on
  the UI.

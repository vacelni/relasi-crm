# 0005. Midtrans Snap, with the payment status re-read from the API

- Status: accepted
- Date: 2026-10-30

## Context

Indonesian customers pay with bank transfer, e-wallets, and QRIS more often than with cards. The project shows a
real payment integration but must not take real money.

## Options considered

1. **Stripe**: an excellent API, but weak coverage of Indonesian payment methods.
2. **Midtrans Snap** (sandbox): hosted checkout with local methods, and notifications by webhook.
3. **Xendit**: similar coverage. Snap's hosted checkout is the more common flow among Indonesian shops.

## Decision

Midtrans Snap in sandbox mode. The database prices the order (`billing_orders`), Snap collects the payment, and the
webhook upgrades the plan. The notification's SHA-512 signature covers the order, status code, and amount but
**not** the transaction status, so the webhook:

1. verifies the signature with a constant-time compare,
2. re-reads the transaction status from the Midtrans API,
3. requires the paid amount to equal the amount the database priced,
4. applies the result through one SQL function with an idempotent state machine.

## Consequences

- Good: a forged or replayed notification cannot upgrade a plan.
- Trade-off: one extra API call per notification.
- Trade-off: sandbox only. Production needs a merchant account and a registered business.

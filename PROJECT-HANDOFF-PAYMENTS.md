# Women Rise Legacy — Phase 3.1 Payment Gateway Handoff

## Status
The codebase now contains a configurable payment gateway manager. The merchant still needs to enter provider credentials and complete provider account activation before live payments can be accepted.

## Supported methods
- Stripe: one-time card payments and monthly recurring donations
- PayPal: one-time PayPal Checkout payments
- Bank transfer: configurable instructions, pending references, admin reconciliation
- Demo fallback: local testing only when `PAYMENT_MODE=demo` and no real gateway is enabled

## Installation
1. Preserve the working `client/.env` and `server/.env` files.
2. Run `0-SETUP-PHASE-3.1-PAYMENTS.bat`.
3. Run `supabase/PHASE-3.1-PAYMENT-GATEWAYS.sql` in Supabase.
4. Start with `2-start-project.bat`.
5. Open Admin → Payment Methods.

## Security model
- Admin credentials are transmitted only to protected backend endpoints.
- Secret values are encrypted using AES-256-GCM before database storage.
- The encryption root is `PAYMENT_CREDENTIALS_ENCRYPTION_KEY` from the server environment.
- Saved secrets are never returned to the frontend; only masked fingerprints are shown.
- No payment secret belongs in `client/.env` or a `VITE_*` variable.
- Do not change or delete the encryption key after gateways are saved. To rotate it, disconnect gateways first, rotate, then reconnect credentials.

## Webhooks
Stripe: `/api/payments/webhooks/stripe`

PayPal: `/api/payments/webhooks/paypal`

The live URL must use HTTPS and be configured in the respective provider dashboard. Stripe requires its signing secret. PayPal reconciliation requires its Webhook ID.

## Production activation
- Enter sandbox/test credentials and verify checkout first.
- Add live credentials only after the merchant account is approved.
- Configure live webhooks.
- Perform a low-value live payment and refund test.
- Set `PAYMENT_MODE=disabled` after a real gateway is enabled to prevent demo fallback.
- Rotate the Supabase service-role key previously exposed during development.

## Important limitation
PayPal recurring subscriptions are not advertised as active in this release because they require separate PayPal product and billing-plan setup. Stripe handles monthly recurring donations.

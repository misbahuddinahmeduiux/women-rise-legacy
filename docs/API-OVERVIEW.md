# API Overview — Phase 3

Base path: `/api`

## Service

- `GET /health`
- `GET /ready`

## Public

- Existing Phase 1/2 public content endpoints
- `GET /public/settings`

## Authentication and dashboard

- `GET /dashboard/me`
- `PUT /dashboard/notification-preferences`
- `POST /dashboard/event-registrations/:id/cancel`
- `POST /dashboard/mentor-requests/:id/cancel`

## Payments

- `POST /payments/checkout`
- `POST /payments/webhook`
- `GET /payments/session/:sessionId`
- `GET /payments/receipt/:token`
- `GET /payments/my-recurring`
- `POST /payments/recurring/:id/cancel`

## Admin Phase 3

- `GET /admin/donation-receipts`
- `POST /admin/donation-receipts/:id/resend`
- `GET /admin/email-queue`
- `POST /admin/email-queue/:id/retry`
- `GET /admin/audit-logs`
- `GET /admin/site-settings`
- `PUT /admin/site-settings/:key`

All authenticated API calls use a Supabase bearer access token. Admin endpoints also verify the profile role.

## Phase 3.1 Payment Gateway Manager

### Public checkout
- `GET /api/payments/methods` — enabled, sanitized payment methods
- `POST /api/payments/checkout` — start Stripe, PayPal, bank-transfer, or demo checkout
- `POST /api/payments/paypal/capture` — capture an approved PayPal order
- `GET /api/payments/manual/:reference` — bank-transfer instructions for a generated reference
- `GET /api/payments/session/:sessionId` — receipt/payment reconciliation status
- `GET /api/payments/receipt/:token` — paid donation receipt

### Webhooks
- `POST /api/payments/webhooks/stripe`
- `POST /api/payments/webhooks/paypal`
- Legacy Stripe alias retained: `POST /api/payments/webhook`

### Admin payment configuration
All routes require an authenticated administrator/donation manager.
- `GET /api/admin/payment-methods`
- `POST /api/admin/payment-methods/:provider/connect`
- `POST /api/admin/payment-methods/:provider/test`
- `PATCH /api/admin/payment-methods/:provider`
- `POST /api/admin/payment-methods/:provider/disconnect`
- `GET /api/admin/payment-methods/transactions/list`
- `PATCH /api/admin/payment-methods/transactions/:id/status`

Supported provider identifiers: `stripe`, `paypal`, and `bank_transfer`.

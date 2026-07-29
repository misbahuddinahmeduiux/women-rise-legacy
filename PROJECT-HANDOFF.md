# Women Rise Legacy — Phase 3 Final Handoff

## Release

- Version: 3.0.0
- Stack: React 19 + TypeScript + Vite, Node.js + Express + TypeScript, Supabase PostgreSQL/Auth, Stripe-ready payments
- Hosting: Vercel frontend, Render/Vercel backend
- Brand: Women Rise Legacy Network with Women Rise Legacy Foundation workflows

## Continue from this state

Phase 1, Phase 2, and Phase 3 source code are combined in this package. The working Phase 2 Supabase project must be preserved. Run only `supabase/PHASE-3-SETUP-ALL.sql` to add final production tables and fields.

## Phase 3 completed modules

### Donation operations

- Receipt number generation in PostgreSQL
- Secure UUID receipt tokens
- Public receipt page that does not expose donor email
- Print and text-download receipt actions
- Demo payment receipt flow
- Stripe checkout and webhook receipt flow
- Anonymous donor option
- Donor message field
- Authenticated donation ownership
- Recurring donation records
- Recurring donation cancellation
- Admin receipt list and resend queue

### Authentication and member experience

- Forgot-password page
- Supabase password reset email flow
- New-password page
- Expanded member dashboard
- Donation receipt links
- Recurring donation status
- Event registration cancellation
- Notification preferences
- Improved API timeout and connectivity messages

### Workflow and communication

- Transactional email queue
- Optional Resend adapter
- Submission acknowledgement emails
- Membership, mentorship, and event registration acknowledgement emails
- Application and submission status-change emails
- Email retry queue in admin
- Messages remain queued safely when no provider key is configured

### Governance and security

- Admin audit log
- Status history table
- Site settings table/editor
- Request IDs in API responses
- Health and readiness endpoints
- Disabled Express signature
- Trusted proxy configuration
- CORS allowlist retained
- Rate limits retained
- Environment secrets remain server-only

### Quality and accessibility

- React error boundary
- Accessibility skip link
- API availability banner
- Responsive receipt/dashboard/admin interfaces
- SEO metadata component
- robots.txt
- Print stylesheet for receipts

## Phase 3 migration

Run:

`supabase/PHASE-3-SETUP-ALL.sql`

It adds/extends:

- donations receipt and ownership fields
- recurring_donations
- notification_preferences
- email_queue
- admin_audit_logs
- application_status_history
- site_settings
- triggers, indexes, RLS policies, and default settings

## Environment variables

### Frontend

- VITE_API_URL
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY

### Backend

- PORT
- CLIENT_URL
- CLIENT_URLS
- APP_URL
- APP_NAME
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- PAYMENT_MODE
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- STRIPE_CURRENCY
- RESEND_API_KEY
- EMAIL_FROM

Never expose the service-role/secret key in frontend code.

## External limitations

A ZIP cannot create live Stripe/Resend accounts, enter hosting secrets, verify domains, or change Supabase dashboard URLs. Those account-level actions remain in `PENDING-TASKS.md`.

## New-chat prompt

Read `PROJECT-HANDOFF.md`, `CURRENT-PROGRESS.md`, and `PENDING-TASKS.md`. Continue Women Rise Legacy Phase 3 from the next incomplete external production task. Preserve the React + Express + Supabase architecture, official purple/gold branding, client assets, existing authentication fix, and all migrations. Do not rebuild completed modules.

## Phase 3.1 payment handoff
- Admin Payment Methods manager added.
- Supported: Stripe (one-time + monthly), PayPal (one-time), bank transfer (manual reconciliation).
- Credentials are encrypted server-side with `PAYMENT_CREDENTIALS_ENCRYPTION_KEY`.
- Run `supabase/PHASE-3.1-PAYMENT-GATEWAYS.sql` before using payment settings.
- Webhooks: `/api/payments/webhooks/stripe` and `/api/payments/webhooks/paypal`.
- Real live processing remains disabled until the client enters approved live merchant credentials and enables a connected method.

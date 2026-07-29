# Phase 3 Installation Guide

## Prerequisites

- Existing working Phase 2 Supabase project
- Existing working Phase 2 `server/.env`
- Node.js 20.19+ or Node.js 22 LTS
- npm internet access

## Installation

1. Extract Phase 3 into a new folder.
2. Run `0-SETUP-PHASE-3.bat`.
3. Paste the path to the working Phase 2 project when requested.
4. Open the existing Supabase project and run `supabase/PHASE-3-SETUP-ALL.sql`.
5. Run `supabase/PHASE-3-VERIFY.sql` to confirm the new schema.
6. Start the application with `2-start-project.bat`.
7. Sign out and sign back in.

## Local URLs

- Frontend: `http://localhost:5173`
- API health: `http://localhost:5050/api/health`
- API readiness: `http://localhost:5050/api/ready`
- Dashboard: `http://localhost:5173/dashboard`
- Admin: `http://localhost:5173/admin`

## Email mode

When `RESEND_API_KEY` is blank, email events are stored in the admin Email Queue. This is intentional and allows complete local testing without sending real email.

To enable delivery:

- Create/verify a sending domain in Resend.
- Set `RESEND_API_KEY` in `server/.env` or the backend hosting dashboard.
- Set `EMAIL_FROM` to a verified sender.

## Payment mode

`PAYMENT_MODE=demo` creates a paid demo record and receipt without charging a card.

For Stripe live mode:

- Set `PAYMENT_MODE=stripe`.
- Add `STRIPE_SECRET_KEY`.
- Add `STRIPE_WEBHOOK_SECRET`.
- Configure the webhook endpoint `/api/payments/webhook`.
- Do not test live credentials in screenshots or source files.

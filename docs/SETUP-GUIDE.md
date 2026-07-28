# Setup Guide

## 1. Install packages

Windows: double-click `1-install-packages.bat`.

Manual command:

```bash
npm install
```

## 2. Configure Supabase

Create a Supabase project, then run `supabase/PHASE-1-SETUP-ALL.sql` in the SQL Editor. The numbered migration files are also included separately for versioned deployment workflows.

Copy values into `client/.env`:

```env
VITE_API_URL=http://localhost:5050/api
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_KEY
```

Copy values into `server/.env`:

```env
PORT=5050
CLIENT_URL=http://localhost:5173
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
PAYMENT_MODE=demo
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_CURRENCY=usd
```

The service-role key belongs only in `server/.env`; never put it in the React client.

## 3. Create the first admin

Register through `/register`. Replace the email in `003_make_first_admin.sql`, uncomment the command, and run it in Supabase SQL Editor.

## 4. Start

Windows: double-click `2-start-project.bat`.

Manual:

```bash
npm run dev
```

## 5. Stripe

Keep `PAYMENT_MODE=demo` for local demo donations. For Stripe testing, set `PAYMENT_MODE=stripe`, add a secret key and webhook secret, then point Stripe CLI or Dashboard webhooks to:

`POST http://localhost:5050/api/payments/webhook`

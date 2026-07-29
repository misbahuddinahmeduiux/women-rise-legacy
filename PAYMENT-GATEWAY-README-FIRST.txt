WOMEN RISE LEGACY — PHASE 3.1 PAYMENT GATEWAY MANAGER
======================================================

WHAT WAS ADDED
- Admin Panel > Payment Methods
- Stripe connection using publishable key, secret key, and webhook signing secret
- PayPal connection using Client ID, Client Secret, and Webhook ID
- Bank transfer as an additional configurable payment method
- Real-time Connect & Verify button
- Enable/disable payment methods without code changes
- Test/live environment selection
- Encrypted server-side credential storage
- Sanitized admin responses: saved secrets are never returned to the browser
- Stripe one-time and monthly donations
- PayPal one-time donations
- Bank-transfer instructions and admin reconciliation
- Automatic payment receipts after confirmed Stripe/PayPal payments
- Admin payment transaction list and manual bank-transfer approval
- Payment webhook event log for idempotency and debugging

INSTALLATION
1. Copy your working Phase 3 client/.env and server/.env into this project if they are not already present.
2. Double-click:
   0-SETUP-PHASE-3.1-PAYMENTS.bat
3. In Supabase SQL Editor run:
   supabase\PHASE-3.1-PAYMENT-GATEWAYS.sql
4. Optional verification:
   supabase\PHASE-3.1-VERIFY.sql
5. Run:
   2-start-project.bat
6. Sign in as admin and open:
   Admin Dashboard > Payment Methods

ADMIN CONNECTION FLOW
- Select test/sandbox mode first.
- Enter credentials.
- Click Connect & verify.
- The backend tests the credentials against the provider.
- After success, Connected appears and the method can be enabled at checkout.
- Future key changes are performed in the same admin screen; no source-code change is needed.
- Blank secret fields preserve the currently encrypted value.
- Disconnect removes stored secret credentials and disables the method.

STRIPE
Admin fields:
- Publishable Key
- Secret Key
- Webhook Signing Secret
- Currency

Webhook endpoint:
  LOCAL: http://localhost:5050/api/payments/webhooks/stripe
  LIVE:  https://YOUR-API-DOMAIN/api/payments/webhooks/stripe

Recommended Stripe events:
- checkout.session.completed
- customer.subscription.deleted
- charge.refunded

Stripe supports:
- One-time donations
- Monthly recurring donations
- Automatic receipt creation after verified webhook completion

PAYPAL
Admin fields:
- Client ID
- Client Secret
- Webhook ID
- Currency

Webhook endpoint:
  LOCAL: http://localhost:5050/api/payments/webhooks/paypal
  LIVE:  https://YOUR-API-DOMAIN/api/payments/webhooks/paypal

Recommended PayPal events:
- PAYMENT.CAPTURE.COMPLETED
- PAYMENT.CAPTURE.DENIED
- PAYMENT.CAPTURE.REFUNDED

PayPal supports one-time donations in this release. PayPal recurring billing requires separate product/plan approval and is intentionally not presented as active.

BANK TRANSFER
Admin can configure:
- Bank name
- Account name
- Account number
- Routing number
- IBAN
- SWIFT/BIC
- Transfer instructions

A pending donation reference is generated. After funds arrive, admin opens Payment Methods > Recent payment records and marks the transfer Paid. The receipt is then generated and queued for email.

SECURITY
- Do not place Stripe Secret Key or PayPal Client Secret in client/.env.
- Admin forms send credentials only to authenticated admin backend endpoints.
- Credentials are encrypted with AES-256-GCM before Supabase storage.
- PAYMENT_CREDENTIALS_ENCRYPTION_KEY stays only in server/.env / Render environment variables.
- Production admin and checkout pages must use HTTPS.
- Database rows never expose decrypted credentials through public RLS policies.
- Rotate the Supabase service-role key previously exposed during development before production launch.

PRODUCTION ENVIRONMENT
Add this secret to Render/server environment variables:
  PAYMENT_CREDENTIALS_ENCRYPTION_KEY=<64-character random hex value>

After at least one real payment gateway is connected and enabled, use:
  PAYMENT_MODE=disabled

This disables the local demo fallback. Restart/redeploy the backend after changing server environment variables.

IMPORTANT
A Connect success confirms provider credentials. Real payment acceptance still depends on the merchant account being activated, verified, supported in its country, and configured according to the provider's requirements.

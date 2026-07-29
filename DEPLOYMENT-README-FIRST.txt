WOMEN RISE LEGACY — PHASE 3 DEPLOYMENT
======================================

CODE PACKAGE STATUS
-------------------
Phase 1 + Phase 2 + Phase 3 application code is included.
External hosting account actions still require dashboard access.

DEPLOYMENT ORDER
----------------
1. Run supabase\PHASE-3-SETUP-ALL.sql in the existing Supabase project.
2. Push this Phase 3 folder to the GitHub repository.
3. Deploy backend using render.yaml or the Render Web Service settings below.
4. Verify /api/health and /api/ready.
5. Deploy client/ to Vercel.
6. Update backend CLIENT_URL and APP_URL to the exact Vercel origin.
7. Update Supabase Auth Site URL and redirect URLs.
8. Test login, password reset, dashboard, receipts, admin, and forms.

RENDER BACKEND
--------------
Root Directory: server
Build Command: npm install && npm run build
Start Command: npm start
Health Check: /api/health

Required variables:
CLIENT_URL
APP_URL
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
PAYMENT_MODE
STRIPE_CURRENCY
APP_NAME

Optional:
CLIENT_URLS
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
RESEND_API_KEY
EMAIL_FROM

VERCEL FRONTEND
---------------
Root Directory: client
Framework: Vite
Install: npm install
Build: npm run build
Output: dist

Variables:
VITE_API_URL
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY

NEVER put SUPABASE_SERVICE_ROLE_KEY in Vercel frontend variables.

PRODUCTION SECURITY
-------------------
Rotate any previously exposed Supabase secret before final production handover.
Use a verified sender/domain before enabling real email delivery.
Use Stripe live mode only with organization-approved credentials.

PHASE 3.1 PAYMENT DEPLOYMENT
----------------------------
Run supabase/PHASE-3.1-PAYMENT-GATEWAYS.sql before opening Admin > Payment Methods.
Add PAYMENT_CREDENTIALS_ENCRYPTION_KEY to the backend/Render environment only.
Configure live webhook URLs:
- /api/payments/webhooks/stripe
- /api/payments/webhooks/paypal
Do not add Stripe or PayPal secret credentials to Vercel frontend variables.
See PAYMENT-GATEWAY-README-FIRST.txt.

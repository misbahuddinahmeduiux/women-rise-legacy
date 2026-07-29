WOMEN RISE LEGACY — PHASE 4
Membership, Mentorship, Podcast & Dynamic CMS

WHAT THIS PACKAGE ADDS
- Dynamic membership plans and public pricing
- Monthly, yearly, one-time fixed-duration, and lifetime billing per plan
- Automatic membership activation after verified successful payment
- Stripe, PayPal, bank-transfer, demo, and complimentary membership records
- Membership trials, subscriptions, renewals, cancellation-at-period-end, expiry, receipts, and payment history
- Admin member and mentor invitation without setting passwords manually
- Rise / Legacy / Elite access enforcement
- Mentor requests, manual matching, mentor acceptance/decline, sessions, private notes, and mentor dashboard
- Podcast episodes, categories, guests, public archive, and episode pages
- Dynamic homepage, membership, podcast, directories, Foundation listings, impact, forms, navigation, footer, announcement, organization details, and SEO copy
- Dynamic form options and categories
- Supabase media library for images, PDFs, and audio
- Editable transactional email templates

USE ONE PACKAGE ONLY
- Full package: extract into a new folder and copy the two working .env files.
- Upgrade patch: paste over a backed-up working Phase 3.1 folder.
- Do not apply the upgrade patch on top of the full package.

INSTALL INTO A NEW EXTRACTED FOLDER
1. Copy `client/.env` and `server/.env` from the working Phase 3.1 project.
2. Run `0-SETUP-PHASE-4.bat`.
3. In Supabase SQL Editor, run `supabase/PHASE-4-DYNAMIC-CMS.sql` once.
4. Optionally run `supabase/PHASE-4-VERIFY.sql`.
5. Run `2-start-project.bat`.
6. Open Admin Dashboard > Phase 4 CMS.

ADMIN AREAS
- Membership Plans
- Members & Mentors
- Membership Billing
- Mentorship
- Podcast
- Website CMS
- Form Options
- Media Library
- Email Templates
- Payment Methods

MEMBERSHIP RULES
- Rise: member directory and basic-resource access.
- Legacy: Rise access plus mentorship requests.
- Elite: Legacy access plus priority/private mentorship.
- Stripe/PayPal membership activates only after verified provider confirmation.
- Bank transfer activates after an administrator marks the payment paid.
- Complimentary membership activates after an authorized administrator assigns it.

PAYMENT TESTING
1. Connect Stripe test credentials and PayPal Sandbox credentials from Admin > Payment Methods.
2. Deploy the backend to a public HTTPS URL.
3. Register the Stripe and PayPal webhook URLs listed in PAYMENT-GATEWAY-README-FIRST.txt.
4. Test successful, cancelled, failed, renewal, past-due, cancellation, and receipt scenarios.
5. Enable live credentials only after merchant approval and sandbox acceptance testing.

SECURITY
- Never put Stripe secrets, PayPal client secrets, Supabase service-role keys, or the payment encryption key in `client/.env`.
- `PAYMENT_CREDENTIALS_ENCRYPTION_KEY` must remain stable in the backend environment because it encrypts stored gateway credentials.
- The admin browser submits gateway credentials to protected backend endpoints; stored secrets are encrypted and are never returned to the browser.
- Rotate every secret previously exposed in a screenshot, message, log, repository, or frontend bundle before production.

VALIDATION NOTE
The source passed repository-wide TypeScript/TSX syntax checks and client/server semantic checks with local type stubs. The package registry in the build environment returned HTTP 503, so a real dependency installation and Vite production build could not be completed here. `0-SETUP-PHASE-4.bat` performs npm installation, type checking, and the production build on your computer and stops on any error.

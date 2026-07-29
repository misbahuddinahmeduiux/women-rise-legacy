WOMEN RISE LEGACY — PHASE 3 FINAL PRODUCTION PACKAGE
=====================================================

THIS ZIP CONTAINS PHASE 1 + PHASE 2 + PHASE 3 SOURCE CODE.
Use the SAME Supabase project already configured for the working Phase 2 installation.

FAST INSTALL ORDER
------------------
1. Keep the working Phase 2 folder as a backup.
2. Extract this ZIP into a NEW folder.
3. Double-click 0-SETUP-PHASE-3.bat.
4. When asked, paste the path of the previous WORKING Phase 2 project folder.
   The script copies the private server/.env safely and installs packages.
5. Open Supabase SQL Editor in the existing Women Rise Legacy project.
6. Open supabase\PHASE-3-SETUP-ALL.sql, copy all SQL, paste it, and click Run.
7. Optional: run supabase\PHASE-3-VERIFY.sql.
8. Double-click 2-start-project.bat.
9. Sign out and sign in again.
10. Test:
    - http://localhost:5173/login
    - http://localhost:5173/forgot-password
    - http://localhost:5173/dashboard
    - http://localhost:5173/admin
    - http://localhost:5050/api/health
    - http://localhost:5050/api/ready

PHASE 3 DATABASE
----------------
Run only:
  supabase\PHASE-3-SETUP-ALL.sql

Do not rerun older setup files unless you are intentionally rebuilding a new database.

PHASE 3 FEATURES
----------------
- Donation receipt numbers and secure receipt links
- Demo and Stripe-ready receipt workflow
- Recurring donation records and cancellation
- Password reset and secure update pages
- Notification preferences
- Transactional email queue with optional Resend delivery
- Admin receipt management
- Admin email queue and retry controls
- Admin audit logs
- Application/submission status history
- Site settings and feature configuration
- Request IDs and improved production error messages
- API health and database-readiness checks
- Accessibility skip link and offline API status
- SEO metadata utilities, robots.txt, and print-ready receipts
- Responsive Phase 3 dashboard and admin interfaces

PAYMENTS AND EMAIL
------------------
- PAYMENT_MODE=demo works locally without charging money.
- Stripe live mode requires valid Stripe keys and webhook configuration.
- Email messages remain queued if RESEND_API_KEY is empty.
- Add RESEND_API_KEY and a verified EMAIL_FROM value to enable delivery.

SECURITY
--------
- Real .env files and private keys are NOT included.
- Never add SUPABASE_SERVICE_ROLE_KEY to client/.env or Vercel frontend variables.
- Rotate any previously exposed secret before a real production launch.

DAILY START
-----------
After setup:
  2-start-project.bat

NEW CHAT CONTINUATION
---------------------
Upload PROJECT-HANDOFF.md and CURRENT-PROGRESS.md and say:
"Read these handoff files and continue Women Rise Legacy from the next pending production task."

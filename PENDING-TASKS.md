# Pending External Production Tasks — Phase 4

The Phase 4 source package is implemented. The following tasks require the client’s Supabase, hosting, payment-provider, domain, or email accounts.

1. Back up the working Phase 3.1 project and database.
2. Run `supabase/PHASE-4-DYNAMIC-CMS.sql` in Supabase SQL Editor.
3. Run `supabase/PHASE-4-VERIFY.sql` and confirm all required CMS/template rows show `OK`.
4. Confirm the `wrl-media` storage bucket exists and Phase 4 tables have RLS enabled.
5. Run `0-SETUP-PHASE-4.bat`, then `2-start-project.bat`.
6. Test normal signup, email verification, login, password reset, and profile completion.
7. Test dynamic plan create/edit/hide/order and all enabled billing cycles.
8. Connect Stripe test credentials and register the Stripe webhook endpoint.
9. Connect PayPal Sandbox credentials and register the PayPal webhook endpoint and ID.
10. Test successful, cancelled, failed, renewed, past-due, cancelled-at-period-end, and refunded payment scenarios.
11. Test automatic membership activation only after verified successful payment.
12. Test Rise directory access, Legacy mentorship requests, and Elite priority/private mentorship.
13. Test admin member/mentor invitation, matching, mentor response, sessions, and private notes.
14. Test podcast create/edit/publish/unpublish and public episode rendering.
15. Test homepage/page/navigation/footer/announcement/SEO CMS updates.
16. Test media uploads and editable email templates.
17. Deploy backend and verify `/api/health` and `/api/ready`.
18. Deploy frontend and confirm direct-route refreshes.
19. Set production `CLIENT_URL`, `APP_URL`, `VITE_API_URL`, CORS, Supabase Auth Site URL, and redirect URLs.
20. Set a stable production `PAYMENT_CREDENTIALS_ENCRYPTION_KEY`; do not rotate it without re-encrypting stored gateway credentials.
21. Configure a verified sender and real email-delivery provider.
22. Complete merchant KYC/approval and only then enable live Stripe/PayPal credentials.
23. Run one controlled low-value live payment and refund test.
24. Rotate any Supabase or payment secret previously exposed in chat, screenshots, logs, or source control.

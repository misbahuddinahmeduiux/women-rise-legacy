# Women Rise Legacy — Phase 4 Handoff

## Locked business flow

1. A visitor creates an account and verifies the email address.
2. The authenticated user selects an active membership plan and an enabled monthly, yearly, or one-time billing option.
3. Stripe, PayPal, bank transfer, demo, or complimentary processing creates a membership payment record.
4. Stripe and PayPal memberships activate only after verified provider confirmation. Bank transfer requires admin reconciliation. Complimentary access requires an authorized admin action.
5. Successful payment automatically assigns the plan, activates access, creates/updates the subscription, records the receipt, and queues the confirmation email.
6. Rise receives directory/basic-resource access, Legacy can request mentorship, and Elite receives priority/private mentorship.
7. Recurring access follows provider lifecycle events. Cancellation-at-period-end preserves access through the paid period; expiry or immediate provider termination removes active status.

## Admin-managed modules

### Membership
- Create, edit, order, feature, hide, or delete plans when safe.
- Configure monthly, yearly, one-time fixed-duration, and lifetime prices.
- Configure currency, trials, auto-renewal, grace period, benefits, badges, and access rules.
- Review membership payments and subscriptions.
- Reconcile bank-transfer payments.

### Members and mentors
- Invite a member or mentor by email without assigning a password.
- Assign optional complimentary membership.
- Edit member/mentor profile, status, visibility, expertise, availability, and featured state.
- Review member payment and subscription records.

### Mentorship
- Review Legacy and Elite requests.
- Create a manual mentor/member match.
- Allow mentor acceptance or decline.
- Schedule, complete, cancel, or mark sessions no-show.
- Keep mentor-private notes restricted to mentor/admin workflows.

### Podcast
- Create, edit, publish, unpublish, and delete episodes.
- Manage categories and guests.
- Link a guest to a mentor profile.
- Publish audio, YouTube, Spotify, and Apple Podcasts links.

### Dynamic website CMS
- Homepage slider, founder section, pathways, featured-section labels, podcast section, and CTA.
- About, Programs, Get Involved, Membership, Podcast, directory/listing pages, Impact, and form-page hero content.
- Header navigation, footer columns, announcement bar, organization details, social links, and SEO defaults.
- Dynamic form options/categories.
- Images, PDFs, and audio through Supabase Storage.
- Transactional email templates and placeholder variables.

## Security boundary

Authentication, password handling, payment verification, webhook signatures, role authorization, encryption, membership-access checks, database validation, receipt integrity, and audit logs remain backend-controlled. Authorized administrators edit content and business configuration, not security-critical code.

## Installation

1. Back up the current working Phase 3.1 folder and Supabase database.
2. Use either the full Phase 4 package or the Phase 3.1-to-4 upgrade patch—not both.
3. For a full package, copy the working `client/.env` and `server/.env` into matching folders.
4. Run `0-SETUP-PHASE-4.bat`.
5. Run `supabase/PHASE-4-DYNAMIC-CMS.sql` once in Supabase SQL Editor.
6. Run `supabase/PHASE-4-VERIFY.sql` and review missing rows/RLS/storage output.
7. Start with `2-start-project.bat`.
8. Open the admin dashboard and test each Phase 4 tab.

## Production acceptance tests

- Signup, email verification, login, password reset, logout, and session restoration.
- Dynamic plan creation, editing, visibility, order, and every enabled billing cycle.
- Stripe test payment, trial, initial subscription charge, renewal, failed payment, cancellation, and webhook replay.
- PayPal Sandbox one-time order, subscription, trial, initial sale, renewal, failed payment, cancellation, and webhook replay.
- Bank-transfer pending payment and admin-paid reconciliation.
- Automatic plan assignment, profile access, subscription dates, receipt, and confirmation email.
- Rise mentorship rejection, Legacy request acceptance, and Elite priority request.
- Mentor invitation, matching, acceptance/decline, session lifecycle, and private notes.
- Podcast draft/publish/unpublish and public rendering.
- CMS, navigation, footer, announcement, form options, media, SEO, and email-template edits.
- Mobile layouts, keyboard navigation, accessibility labels, direct-route refreshes, CORS, health/readiness, and production build.

## External responsibilities

Merchant account approval/KYC, bank linking, production hosting, DNS, HTTPS, webhook registration, production environment variables, verified email sender, legal policies, tax/accounting decisions, chargeback/refund policy, and final live transaction acceptance belong to the client/administrator.

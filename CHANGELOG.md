# Changelog

## 2.0.0 — Phase 2 Network

- Replaced green demo theme with official purple/gold Women Rise Legacy branding.
- Added official logo, emblem crop, founder image, event images, banner, and brand assets.
- Redesigned homepage, navigation, footer, About, and action pathways.
- Added Rise, Legacy, and Elite membership plans.
- Added member directory and extended profiles.
- Added mentor directory and manual request workflow.
- Added business directory and product/service catalog.
- Added Opportunity Center and member resource library.
- Added Network events, registrations, chapters, and success stories.
- Expanded personal member dashboard.
- Expanded admin dashboard for Network and Foundation content.
- Added Phase 2 Supabase schema, RLS, indexes, triggers, and demo records.
- Preserved working Phase 1 Foundation functionality.
- Preserved the authentication v1.0.2 fix.

## 1.0.1 / 1.0.2 — Authentication fixes

- Fixed frontend/backend Supabase token validation.
- Added publishable-key forwarding and server token verification.

## 1.0.0 — Phase 1 Foundation MVP

- Initial React, Express, and Supabase Foundation platform.

## 2.1.0 — Responsive homepage and branding refinement
- Added a three-slide responsive homepage hero carousel.
- Added the official transparent founder image to the hero and founder section.
- Fixed the Donate navigation button sizing, alignment, focus, and mobile presentation.
- Moved the responsive navigation breakpoint to support laptop and tablet widths without crowding.
- Added carousel controls, indicators, hover pause, and accessibility labels.
- Added desktop, laptop, tablet, and mobile layout refinements.
- Replaced the Phase 2 setup SQL with the corrected PostgreSQL-compatible version.

## 3.0.0 — Phase 3 Final Production Package

- Added donation receipts, secure receipt links, recurring donations, and donor preferences.
- Added password recovery and new-password pages.
- Added notification preferences and expanded member dashboard.
- Added email queue with optional Resend delivery.
- Added admin receipts, email queue, audit logs, settings, and status controls.
- Added application status history and governance database tables.
- Added request IDs, readiness endpoint, error boundary, accessibility, SEO, and print styles.
- Added Phase 3 SQL migration, setup scripts, verification script, and final handoff documentation.

## 3.1.0 — Admin-Configured Payment Gateways
- Added Payment Methods section to the admin panel.
- Added encrypted Stripe, PayPal, and bank-transfer configuration.
- Added real-time connection testing, enable/disable, disconnect, and masked secret status.
- Added dynamic checkout provider selection.
- Added Stripe webhook reconciliation and recurring donations.
- Added PayPal Orders API create/capture flow and verified webhook handling.
- Added manual bank-transfer references and admin reconciliation.
- Added payment gateway event logging and dedicated Supabase migration.

## 4.0.0 — Membership, Mentorship, Podcast & Dynamic CMS

- Replaced hardcoded membership cards with database-driven plans, prices, billing cycles, access rules, badges, order, and visibility.
- Added monthly, yearly, one-time fixed-duration, and one-time lifetime billing options.
- Added verified-payment membership activation, trials, renewals, grace periods, cancellation-at-period-end, expiry, receipts, and payment history.
- Added Stripe Checkout membership payments and recurring subscriptions.
- Added PayPal Orders and Subscriptions membership flows with verified webhook reconciliation.
- Added bank-transfer, demo, and complimentary/admin-assigned membership workflows.
- Added admin member and mentor invitations using secure password-creation emails.
- Added Rise, Legacy, and Elite backend access enforcement for directory and mentorship workflows.
- Added mentorship requests, manual matching, mentor acceptance/decline, sessions, private mentor notes, and mentor dashboard.
- Added public podcast archive and episode pages plus admin episode, guest, and category management.
- Added a dynamic website CMS for homepage sections, public-page copy, navigation, footer, announcement, organization details, and SEO defaults.
- Added dynamic form options, Supabase media uploads, and editable transactional email templates.
- Added Phase 4 SQL migration, RLS policies, storage bucket, verification SQL, setup scripts, handoff, and validation documentation.

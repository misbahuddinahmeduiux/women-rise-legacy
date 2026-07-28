# Women Rise Legacy — Complete Project Handoff

## Current release

**Release:** Phase 2 Network + Phase 1 Foundation  
**Version:** 2.0.0  
**Stack:** React 19 + TypeScript + Vite, Node.js + Express + TypeScript, Supabase PostgreSQL/Auth/Storage, Stripe-ready payments  
**Primary brand:** Women Rise Legacy Network  
**Secondary operating arm:** Women Rise Legacy Foundation

## Critical continuation instruction

Continue from this exact state:

> Phase 1 Foundation and Phase 2 Network source code are complete in the combined Phase 2 package. Authentication was fixed using the frontend Supabase publishable key plus backend bearer-token validation. The next database action is to run `supabase/PHASE-2-SETUP-ALL.sql` in the existing Supabase project. After that, test all public Network pages, member dashboard, admin Network modules, membership application, mentor request, and event registration. Do not rebuild from scratch.

## Branding decisions

- Official client logo is included and used.
- Header/footer use an emblem crop generated from the official logo, not a replacement logo.
- The full official logo is displayed on the About page and preserved in the source-assets folder.
- Full official branding remains visible inside the supplied hero and event imagery.
- Primary colors are derived from the logo:
  - deep plum
  - royal purple
  - legacy gold
  - rose/copper accents
  - warm cream/white
- The former green demo theme has been replaced.
- Client event, founder, banner, and design images are used where their composition suits the page.
- No random stock imagery remains as the primary brand presentation.

## Source assets

Original uploaded client assets are preserved at:

- `docs/source-assets/Client-images-original.zip`
- `docs/source-assets/official-logo.jpeg`

Optimized website assets are located at:

- `client/public/assets/brand/logo.webp`
- `client/public/assets/brand/logo-mark.webp`
- `client/public/assets/brand/founder.webp`
- `client/public/assets/brand/hero-network.webp`
- `client/public/assets/brand/event-community.webp`
- `client/public/assets/brand/event-panel.webp`
- `client/public/assets/brand/event-keynote.webp`
- `client/public/assets/brand/event-founder.webp`
- `client/public/assets/brand/website-concept.webp`
- `client/public/assets/brand/mobile-concept.webp`
- `client/public/assets/brand/brand-guide.webp`

## Completed Phase 1 Foundation modules

- Supabase authentication and profiles
- Admin role support
- Current Needs
- Campaigns
- Sponsor a Family
- Donations with demo mode and Stripe-ready mode
- Donate Items
- Shipment Tracking
- Request Assistance
- Volunteer applications
- Partner applications
- Contact form
- Countries served map
- Impact stories
- Impact reports
- Personal dashboard
- Foundation admin CRUD
- Submission review

## Completed Phase 2 Network modules

### Public experience

- Official purple/gold responsive design system
- Redesigned homepage using client branding and event imagery
- About and brand pillars
- Membership plans: Rise, Legacy, Elite
- Membership application workflow
- Public member directory
- Mentor directory
- Manual mentorship request workflow
- Women-owned business directory
- Business details
- Product/service catalog
- Opportunity Center
- Membership resource library
- Network events and internal event registration
- Local chapters
- Member success stories

### Member dashboard

- Extended personal profile
- Headline, biography, skills, city/country, links, business name
- Directory visibility preference
- Membership level and status
- Membership applications
- Mentor requests
- Event registrations
- Membership-level resource access
- Phase 1 donation/application records

### Admin dashboard

- Network overview counts
- Member membership/status management
- Member directory visibility approval
- Mentor approval
- Business CRUD
- Product/service CRUD
- Opportunity CRUD
- Resource CRUD
- Chapter CRUD
- Event CRUD
- Success story CRUD
- Membership application review
- Mentor request review
- Event registration review
- Existing Foundation content and submission management

## Phase 2 database additions

Run `supabase/PHASE-2-SETUP-ALL.sql` once in the existing Supabase project. Then optionally run `supabase/PHASE-2-VERIFY.sql` for read-only verification.

It adds:

- extended `profiles` fields
- `membership_applications`
- `mentor_requests`
- `businesses`
- `products_services`
- `opportunities`
- `resources`
- `chapters`
- `network_events`
- `event_registrations`
- `member_success_stories`
- RLS policies, indexes, triggers, and branded demo data

## Authentication architecture

- Frontend authentication: Supabase Auth with publishable key
- API requests: bearer access token plus public publishable key header
- Backend token validation: Supabase `/auth/v1/user`
- Privileged database access: server-only Supabase secret key
- Admin authorization: profile role check
- Never expose the server secret key in the client or screenshots

## Environment files

Private files are not included:

- `client/.env`
- `server/.env`

Use `.env.example` files or copy the working Phase 1 `.env` files into the new Phase 2 folder.

## Payment status

- `PAYMENT_MODE=demo` works without charging money.
- Stripe code and webhook flow are present.
- Live payments require a verified organization Stripe account and new live secrets.
- No payment credentials are included in the ZIP.

## Known limitations / future Phase 3

- Full multivendor checkout, commissions, vendor withdrawals, and shipping are not included.
- Mentorship matching is manual by design.
- Resource files currently use admin-managed URLs; a full upload library can be added later.
- Direct private member-to-member messaging is not included.
- Advanced group activity feeds and discussion forums are not included.
- Multilingual English/Spanish/French implementation is pending.
- Mobile application is pending.
- Advanced analytics and automated email sequences are pending.

## New-chat continuation prompt

> Read PROJECT-HANDOFF.md, CURRENT-PROGRESS.md, and PENDING-TASKS.md. Continue Women Rise Legacy from the next pending task. Preserve the React + Express + Supabase architecture, official purple/gold branding, client logo/assets, authentication fix, and existing database migrations. Do not remove working Phase 1 or Phase 2 functionality.

## Phase 2.1 UI update
The latest package includes a responsive three-slide homepage carousel. It uses the official transparent founder image at `client/public/assets/brand/founder-transparent.png` and existing approved client event/network visuals for the other slides. The Donate navigation CTA has a dedicated `donate-nav-button` class and custom responsive/focus styling. The navigation collapses at 1180px to avoid laptop-width crowding. Responsive CSS covers desktop, laptop, tablet, mobile, and 420px small-mobile layouts.

Latest UI files:
- `client/src/pages/Home.tsx`
- `client/src/components/Layout.tsx`
- `client/src/index.css`
- `client/public/assets/brand/founder-transparent.png`

Latest database setup file:
- `supabase/PHASE-2-SETUP-ALL.sql` (corrected `current_role` reserved-keyword issue)

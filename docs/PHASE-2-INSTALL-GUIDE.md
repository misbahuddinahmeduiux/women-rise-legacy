# Phase 2 Installation Guide

## Use the existing Supabase project

Phase 2 is a migration, not a separate database. Keep the same Supabase URL, publishable key, secret key, users, admin role, and Phase 1 records.

## Recommended safe installation

1. Back up the Phase 1 folder.
2. Extract the Phase 2 ZIP separately.
3. Copy `client/.env` and `server/.env` from Phase 1.
4. Run `1-install-packages.bat`.
5. Open `supabase/PHASE-2-SETUP-ALL.sql`.
6. Paste the SQL into Supabase SQL Editor and run it.
7. Optionally run `supabase/PHASE-2-VERIFY.sql` to verify tables and seeded records.
8. Start the project with `2-start-project.bat`.
9. Sign out and sign in again.

## SQL success checks

In Supabase Table Editor, confirm these tables exist:

- membership_applications
- mentor_requests
- businesses
- products_services
- opportunities
- resources
- chapters
- network_events
- event_registrations
- member_success_stories

## Browser checks

- `http://localhost:5050/api/health`
- `http://localhost:5050/api/public/businesses`
- `http://localhost:5050/api/public/events`
- `http://localhost:5173/membership`
- `http://localhost:5173/dashboard`
- `http://localhost:5173/admin`

# Data migration notes

Migration 009 preserves Supabase Auth user IDs and existing foreign-key relationships.

- Legacy `admin`, `content_manager`, and `donation_manager` profiles are backfilled into `staff_memberships`.
- Legacy mentors are copied into `mentor_profiles` as `pending_approval`, inactive, and hidden from the directory.
- Legacy `profiles.role = mentor` is normalized to `member` because mentorship is now represented by `mentor_profiles`.
- Legacy `is_mentor` and `mentor_featured` flags are disabled after mentor data is copied.
- Records requiring human review are written to `security_migration_review`.
- Existing active matches receive acceptance/activation timestamps from their legacy start date so valid historical relationships remain usable.
- No Supabase Auth user is deleted, recreated, or reset.

Run `supabase/009-DATA-MIGRATION-REPORT.sql` after the migration and review every unresolved record before approving a public mentor profile.

-- Non-destructive emergency rollback helper for migration 009.
-- This intentionally does NOT restore unsafe broad profile UPDATE grants,
-- does NOT delete new tables, and does NOT recreate legacy mentor/staff coupling.
-- For a full pre-migration restore, use the verified backup in a separate reviewed restore process.
begin;

-- Remove only the new session-insert enforcement if it blocks an emergency application rollback.
drop trigger if exists validate_mentor_session_eligibility_trigger on public.mentor_sessions;
drop function if exists public.validate_mentor_session_eligibility();

-- Keep protected profile-column grants and all migrated data intact.
-- Keep staff_memberships, mentor_profiles, mentor_invitations and audit records intact.

commit;
